import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';

/**
 * GET /api/events/[eventId]/people
 * List all discovered face clusters / people for an event
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const guestToken =
      req.cookies.get(`guest_token_${eventId}`)?.value || req.headers.get('x-guest-token');

    const access = await checkEventAccess(eventId, userId, { guestToken });
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: access.statusCode || 403 }
      );
    }

    const people = await prisma.person.findMany({
      where: { eventId },
      include: {
        faces: {
          select: {
            id: true,
            photoId: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Also get count of photos that have no recognized faces ("Landscapes & Other")
    const photosWithoutFacesCount = await prisma.photo.count({
      where: {
        eventId,
        isDeleted: false,
        faces: { none: {} },
      },
    });

    const formattedPeople = people.map((p) => {
      const distinctPhotoIds = new Set(p.faces.map((f) => f.photoId));
      return {
        id: p.id,
        name: p.name || 'Unnamed Person',
        thumbnailUrl: p.thumbnailUrl || p.faces[0]?.thumbnailUrl || null,
        photoCount: distinctPhotoIds.size,
        faceCount: p.faces.length,
        isCover: p.isCover,
      };
    });

    return NextResponse.json({
      people: formattedPeople,
      otherPhotosCount: photosWithoutFacesCount,
    });
  } catch (err: unknown) {
    console.error('[API people GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to list people' },
      { status: 500 }
    );
  }
}
