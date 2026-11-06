import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EventRole } from '@prisma/client';
import { z } from 'zod';

const createEventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(100),
  description: z.string().max(1000).optional(),
  coverImage: z.string().url().optional().or(z.literal('')),
  eventDate: z.string().optional().or(z.literal('')),
  isPrivate: z.boolean().default(true),
  allowGuestView: z.boolean().default(false),
  allowGuestUpload: z.boolean().default(false),
});

/**
 * GET /api/events
 * List events where the current user is an OWNER or MEMBER
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const memberships = await prisma.eventMember.findMany({
      where: {
        userId,
        event: {
          isDeleted: false,
        },
      },
      include: {
        event: {
          include: {
            _count: {
              select: {
                members: true,
                photos: { where: { isDeleted: false } },
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    const events = memberships.map((m) => ({
      ...m.event,
      userRole: m.role,
    }));

    return NextResponse.json({ events });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events
 * Create a new event and automatically assign the creator as OWNER
 */
export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const json = await req.json();
    const parsed = createEventSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      coverImage,
      eventDate,
      isPrivate,
      allowGuestView,
      allowGuestUpload,
    } = parsed.data;

    // Use a transaction to create the event and the OWNER membership simultaneously
    const newEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          name,
          description: description || null,
          coverImage: coverImage || null,
          eventDate: eventDate ? new Date(eventDate) : null,
          isPrivate,
          allowGuestView,
          allowGuestUpload,
        },
      });

      await tx.eventMember.create({
        data: {
          eventId: event.id,
          userId,
          role: EventRole.OWNER,
        },
      });

      return event;
    });

    return NextResponse.json({
      event: {
        ...newEvent,
        userRole: EventRole.OWNER,
        _count: { members: 1, photos: 0 },
      },
    }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to create event' },
      { status: 500 }
    );
  }
}
