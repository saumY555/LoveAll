import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { z } from 'zod';

const updatePersonSchema = z.object({
  name: z.string().min(1).max(50),
});

/**
 * PATCH /api/events/[eventId]/people/[personId]
 * Rename a recognized person
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; personId: string }> }
) {
  try {
    const { eventId, personId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const access = await checkEventAccess(eventId, userId);
    if (!access.hasAccess || !access.role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updatePersonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Name must be between 1 and 50 characters' },
        { status: 400 }
      );
    }

    const person = await prisma.person.findFirst({
      where: { id: personId, eventId },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const updated = await prisma.person.update({
      where: { id: personId },
      data: { name: parsed.data.name.trim() },
    });

    return NextResponse.json({
      success: true,
      person: updated,
    });
  } catch (err: unknown) {
    console.error('[API person PATCH error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update person' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/events/[eventId]/people/[personId]
 * Dissolve person cluster (Owner or Member)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; personId: string }> }
) {
  try {
    const { eventId, personId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const access = await checkEventAccess(eventId, userId);
    if (!access.hasAccess || !access.role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const person = await prisma.person.findFirst({
      where: { id: personId, eventId },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Unassign faces
    await prisma.face.updateMany({
      where: { personId },
      data: { personId: null, isNoise: true },
    });

    // Delete Person record
    await prisma.person.delete({
      where: { id: personId },
    });

    return NextResponse.json({
      success: true,
      message: 'Person cluster removed successfully',
    });
  } catch (err: unknown) {
    console.error('[API person DELETE error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete person cluster' },
      { status: 500 }
    );
  }
}
