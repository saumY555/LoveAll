import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

const updatePersonSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  isHidden: z.boolean().optional(),
  mergeIntoPersonId: z.string().optional(),
});

/**
 * PATCH /api/events/[eventId]/people/[personId]
 * Update person (rename or hide/unhide)
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
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    // Host check using parsed.data: only OWNER can hide/unhide
    if (parsed.data.isHidden !== undefined && !access.isOwner && access.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only event host can hide or unhide people' },
        { status: 403 }
      );
    }

    const person = await prisma.person.findFirst({
      where: { id: personId, eventId },
      include: { faces: { select: { embedding: true } } },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Handle merging person into another target person in the same event
    if (parsed.data.mergeIntoPersonId) {
      const targetPerson = await prisma.person.findFirst({
        where: { id: parsed.data.mergeIntoPersonId, eventId },
      });
      if (!targetPerson) {
        return NextResponse.json(
          { error: 'Target person for merge not found in this event' },
          { status: 404 }
        );
      }
      if (targetPerson.id === personId) {
        return NextResponse.json(
          { error: 'Cannot merge a person into themselves' },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        // Re-assign all faces
        await tx.face.updateMany({
          where: { personId },
          data: { personId: targetPerson.id },
        });

        // Delete the merged person
        await tx.person.delete({
          where: { id: personId },
        });
      });

      return NextResponse.json({
        success: true,
        message: `Successfully merged into ${targetPerson.name || 'target person'}`,
        mergedInto: targetPerson.id,
      });
    }

    const updateData: Prisma.PersonUpdateInput = {};

    if (parsed.data.name !== undefined) {
      updateData.name = parsed.data.name.trim();
    }

    if (parsed.data.isHidden !== undefined) {
      updateData.isHidden = parsed.data.isHidden;
      if (parsed.data.isHidden) {
        if (person.faces.length > 0) {
          const embs = person.faces.map((f) => f.embedding as number[]);
          const sum = new Array(512).fill(0);
          for (const e of embs) {
            for (let i = 0; i < 512; i++) sum[i] += e[i];
          }
          const norm = Math.hypot(...sum) || 1;
          updateData.hiddenCentroid = sum.map((v) => Number((v / norm).toFixed(6)));
        }
      } else {
        updateData.hiddenCentroid = Prisma.DbNull;
      }
    }

    const updated = await prisma.person.update({
      where: { id: personId },
      data: updateData,
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
