import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess, requireEventRole, invalidateEventAccessCache } from '@/lib/permissions';
import { EventRole } from '@prisma/client';
import { z } from 'zod';

const updateEventSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  coverImage: z.string().url().optional().or(z.literal('')),
  eventDate: z.string().optional().or(z.literal('')),
  isPrivate: z.boolean().optional(),
  allowGuestView: z.boolean().optional(),
  allowGuestUpload: z.boolean().optional(),
});

/**
 * GET /api/events/[eventId]
 * Retrieve event details and current user's permissions
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id;

  const guestToken = _req.cookies.get(`guest_token_${eventId}`)?.value || _req.headers.get('x-guest-token');
  const access = await checkEventAccess(eventId, userId, { guestToken });
  if (!access.hasAccess || !access.event) {
    return NextResponse.json(
      { error: access.error || 'Access denied' },
      { status: access.statusCode || 403 }
    );
  }

  try {
    const fullEvent = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: {
            members: true,
            photos: { where: { isDeleted: false } },
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      event: {
        ...fullEvent,
        userRole: access.role,
        isGuest: access.isGuest ?? false,
        canGuestUpload: access.canGuestUpload ?? false,
        guestIdentity: access.guestIdentity ?? null,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to retrieve event' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/events/[eventId]
 * Update event settings - Restricted strictly to OWNER
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
  if (!roleCheck.allowed) {
    return NextResponse.json(
      { error: roleCheck.error || 'Only the event owner can modify settings' },
      { status: roleCheck.statusCode || 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateEventSchema.safeParse(body);

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

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description: description || null }),
        ...(coverImage !== undefined && { coverImage: coverImage || null }),
        ...(eventDate !== undefined && {
          eventDate: eventDate ? new Date(eventDate) : null,
        }),
        ...(isPrivate !== undefined && { isPrivate }),
        ...(allowGuestView !== undefined && { allowGuestView }),
        ...(allowGuestUpload !== undefined && { allowGuestUpload }),
      },
    });

    invalidateEventAccessCache(eventId);

    return NextResponse.json({ event: updatedEvent });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]
 * Soft delete an event with a 7-day recovery period - Restricted strictly to OWNER
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
  if (!roleCheck.allowed) {
    return NextResponse.json(
      { error: roleCheck.error || 'Only the event owner can delete this event' },
      { status: roleCheck.statusCode || 403 }
    );
  }

  try {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    invalidateEventAccessCache(eventId);

    return NextResponse.json({
      success: true,
      message: 'Event has been soft-deleted. You can recover it within 7 days.',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to delete event' },
      { status: 500 }
    );
  }
}
