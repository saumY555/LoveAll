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
      where: { eventId, isHidden: false },
      include: {
        faces: {
          select: {
            id: true,
            photoId: true,
            thumbnailUrl: true,
            confidence: true,
            boxWidth: true,
            boxHeight: true,
            blurScore: true,
            brightness: true,
            yawDeg: true,
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

    // Apply Quality Gate:
    // 1. Multi-photo: >= 2 distinct photos with qualifying high-quality faces
    // 2. High-Quality Singleton: exactly 1 distinct photo, 1 face, min(w,h) >= 75, conf >= 0.85, brightness >= 40, blur >= 20, |yaw| <= 80
    const formattedPeople = people
      .filter((p) => {
        // High quality face definition for multi-photo support
        const goodFaces = p.faces.filter((f) => {
          const minBox = Math.min(f.boxWidth ?? 0, f.boxHeight ?? 0);
          const conf = f.confidence ?? 0;
          const blur = f.blurScore ?? 0;
          const yaw = Math.abs(f.yawDeg ?? 0);
          return conf >= 0.80 && minBox >= 60 && blur >= 20.0 && (f.yawDeg === null || yaw <= 80);
        });

        const distinctGoodPhotos = new Set(goodFaces.map((f) => f.photoId)).size;
        const distinctAllPhotos = new Set(p.faces.map((f) => f.photoId)).size;

        if (distinctGoodPhotos >= 2) {
          return true;
        }

        // Check High-Quality Singleton rule
        if (distinctAllPhotos === 1 && p.faces.length === 1) {
          const f = p.faces[0];
          const minBox = Math.min(f.boxWidth ?? 0, f.boxHeight ?? 0);
          const conf = f.confidence ?? 0;
          const b = f.brightness ?? 0;
          const blur = f.blurScore ?? 0;
          const yaw = Math.abs(f.yawDeg ?? 0);
          return (
            minBox >= 75 &&
            conf >= 0.85 &&
            b >= 40.0 &&
            blur >= 20.0 &&
            (f.yawDeg === null || yaw <= 80)
          );
        }

        return false;
      })
      .map((p) => {
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
