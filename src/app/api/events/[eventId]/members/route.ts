import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess, requireEventRole } from '@/lib/permissions';
import { EventRole } from '@prisma/client';
import { z } from 'zod';

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['OWNER', 'MEMBER']).default('MEMBER'),
});

const removeMemberSchema = z.object({
  userId: z.string().min(1),
});

/**
 * GET /api/events/[eventId]/members
 * List all members of an event
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const access = await checkEventAccess(eventId, userId);
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: access.statusCode || 403 }
      );
    }

    const members = await prisma.eventMember.findMany({
      where: { eventId },
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
    });

    return NextResponse.json({ members });
  } catch (error: unknown) {
    console.error('[API members GET error]:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to list members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/members
 * Invite / add a user to the event by email (OWNER only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: roleCheck.error || 'Only the event owner can add members' },
        { status: roleCheck.statusCode || 403 }
      );
    }

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const { email, role } = parsed.data;

    // Find the user or create a placeholder user account
    let targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!targetUser) {
      targetUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: email.split('@')[0],
        },
      });
    }

    // Check if already a member
    const existing = await prisma.eventMember.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUser.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'User is already a member of this event' },
        { status: 409 }
      );
    }

    const newMember = await prisma.eventMember.create({
      data: {
        eventId,
        userId: targetUser.id,
        role: role as EventRole,
      },
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
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API members POST error]:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to add member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]/members
 * Remove a member from the event (OWNER only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: roleCheck.error || 'Only the event owner can remove members' },
        { status: roleCheck.statusCode || 403 }
      );
    }

    const body = await req.json();
    const parsed = removeMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { userId: targetUserId } = parsed.data;

    // Prevent owner from deleting themselves if they are the only owner
    if (targetUserId === session.user.id) {
      const ownerCount = await prisma.eventMember.count({
        where: { eventId, role: EventRole.OWNER },
      });
      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the sole owner of an event' },
          { status: 400 }
        );
      }
    }

    await prisma.eventMember.delete({
      where: {
        eventId_userId: {
          eventId,
          userId: targetUserId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Member removed. Their uploaded photos remain in the event.',
    });
  } catch (error: unknown) {
    console.error('[API members DELETE error]:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to remove member' },
      { status: 500 }
    );
  }
}
