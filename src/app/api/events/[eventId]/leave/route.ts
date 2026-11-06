import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { EventRole } from '@prisma/client';

/**
 * POST /api/events/[eventId]/leave
 * Current user leaves the event. Uploaded photos are retained in the gallery.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const membership = await prisma.eventMember.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this event' },
        { status: 404 }
      );
    }

    // If user is OWNER, ensure there is at least one other OWNER before leaving
    if (membership.role === EventRole.OWNER) {
      const ownerCount = await prisma.eventMember.count({
        where: { eventId, role: EventRole.OWNER },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'As the sole owner, you cannot leave the event. Please transfer ownership or delete the event.' },
          { status: 400 }
        );
      }
    }

    await prisma.eventMember.delete({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'You have left the event. Your uploaded photos remain in the event gallery.',
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to leave event' },
      { status: 500 }
    );
  }
}
