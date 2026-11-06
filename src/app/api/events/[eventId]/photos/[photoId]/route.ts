import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { EventRole } from '@prisma/client';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  const { eventId, photoId } = await params;
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const access = await checkEventAccess(eventId, userId);
  if (!access.hasAccess || !access.role) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const isOwner = access.role === EventRole.OWNER;

  try {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId, eventId },
      include: {
        uploadReferences: true,
      },
    });

    if (!photo || photo.isDeleted) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (isOwner) {
      // Event Owner can delete any photo in their event
      await prisma.photo.update({
        where: { id: photoId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Photo removed from event by owner',
      });
    }

    // If Member: check if the member uploaded this photo
    const userReference = photo.uploadReferences.find(
      (ref) => ref.uploadedByUserId === userId
    );

    if (!userReference) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete photos that you uploaded' },
        { status: 403 }
      );
    }

    // Delete the member's upload reference
    await prisma.photoUploadReference.delete({
      where: { id: userReference.id },
    });

    // If no other upload references remain for this photo, mark it deleted
    const remainingCount = await prisma.photoUploadReference.count({
      where: { photoId },
    });

    if (remainingCount === 0) {
      await prisma.photo.update({
        where: { id: photoId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Your upload reference has been deleted',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
