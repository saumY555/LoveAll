import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { EventRole } from '@prisma/client';

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

    const userId = session.user.id;
    const access = await checkEventAccess(eventId, userId);
    if (!access.hasAccess || !access.role) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const photoIds = Array.isArray(body.photoIds) ? body.photoIds.filter((id: unknown) => typeof id === 'string') : [];

    if (photoIds.length === 0) {
      return NextResponse.json({ error: 'No photo IDs provided' }, { status: 400 });
    }

    const isOwner = access.role === EventRole.OWNER;

    if (isOwner) {
      // Event Owner can delete any photos in this event
      const result = await prisma.photo.updateMany({
        where: {
          id: { in: photoIds },
          eventId,
          isDeleted: false,
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        deletedCount: result.count,
        message: `Successfully deleted ${result.count} photo(s)`,
      });
    }

    // Members can only delete photos they uploaded
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        eventId,
        isDeleted: false,
      },
      include: {
        uploadReferences: true,
      },
    });

    const userDeletablePhotos: string[] = [];
    const userRefIdsToDelete: string[] = [];

    for (const p of photos) {
      const userRef = p.uploadReferences.find((r) => r.uploadedByUserId === userId);
      if (userRef) {
        userDeletablePhotos.push(p.id);
        userRefIdsToDelete.push(userRef.id);
      }
    }

    if (userRefIdsToDelete.length > 0) {
      await prisma.photoUploadReference.deleteMany({
        where: { id: { in: userRefIdsToDelete } },
      });
    }

    // Check which photos have 0 remaining references
    let markedDeletedCount = 0;
    for (const pId of userDeletablePhotos) {
      const remainingCount = await prisma.photoUploadReference.count({
        where: { photoId: pId },
      });
      if (remainingCount === 0) {
        await prisma.photo.update({
          where: { id: pId },
          data: { isDeleted: true, deletedAt: new Date() },
        });
        markedDeletedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount: userDeletablePhotos.length,
      markedDeletedCount,
      message: `Successfully removed ${userDeletablePhotos.length} photo(s)`,
    });
  } catch (err: unknown) {
    console.error('[Batch Delete Error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete photos in batch' },
      { status: 500 }
    );
  }
}
