import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { checkEventAccess } from '@/lib/permissions';
import { photoCache } from '@/lib/photoCache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    const guestToken = req.cookies.get(`guest_token_${eventId}`)?.value || req.headers.get('x-guest-token');
    const access = await checkEventAccess(eventId, userId, { guestToken });
    if (!access.hasAccess || !access.event) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: access.statusCode || 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    // Multi-person & single-person filter parameters
    const rawPersonIds = searchParams.getAll('personIds');
    const rawPersonId = searchParams.get('personId');
    const modeParam = searchParams.get('mode')?.toLowerCase();
    const mode: 'all' | 'any' = modeParam === 'any' ? 'any' : 'all';

    let requestedPersonIds: string[] = [];
    if (rawPersonIds.length > 0) {
      requestedPersonIds = rawPersonIds
        .flatMap((p) => p.split(','))
        .map((p) => p.trim())
        .filter(Boolean);
    } else if (rawPersonId) {
      requestedPersonIds = rawPersonId
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    }
    // Deduplicate IDs
    requestedPersonIds = Array.from(new Set(requestedPersonIds));

    let whereClause: any = {
      eventId,
      isDeleted: false,
    };

    const isNoneFilter = requestedPersonIds.includes('none') || rawPersonId === 'none';

    if (isNoneFilter) {
      // Photos with no detected faces ("Landscapes & Other")
      whereClause.faces = { none: {} };
    } else if (requestedPersonIds.length > 0) {
      // Validate that every requested personId belongs to this event
      const validPeople = await prisma.person.findMany({
        where: {
          id: { in: requestedPersonIds },
          eventId,
        },
        select: { id: true },
      });

      if (validPeople.length !== requestedPersonIds.length) {
        return NextResponse.json(
          { error: 'One or more person IDs are invalid or do not belong to this event' },
          { status: 400 }
        );
      }

      if (requestedPersonIds.length === 1) {
        // Single-person filter
        whereClause.faces = { some: { personId: requestedPersonIds[0] } };
      } else if (mode === 'any') {
        // Multi-person "Either" filter (union): at least one selected person appears
        whereClause.faces = {
          some: {
            personId: { in: requestedPersonIds },
          },
        };
      } else {
        // Multi-person "Together" filter (intersection): all selected people appear together
        // Query for photo IDs having COUNT(DISTINCT personId) = N
        const matchingPhotoRows = await prisma.$queryRaw<Array<{ photoId: string }>>`
          SELECT f."photoId"
          FROM "Face" f
          JOIN "Photo" p ON p.id = f."photoId"
          WHERE f."personId" IN (${Prisma.join(requestedPersonIds)})
            AND p."eventId" = ${eventId}
            AND p."isDeleted" = false
          GROUP BY f."photoId"
          HAVING COUNT(DISTINCT f."personId") = ${requestedPersonIds.length}
        `;

        const matchingPhotoIds = matchingPhotoRows.map((r) => r.photoId);

        if (matchingPhotoIds.length === 0) {
          return NextResponse.json({
            photos: [],
            pagination: {
              page,
              limit,
              totalCount: 0,
              totalPages: 0,
              hasMore: false,
            },
            matchCount: 0,
          });
        }

        whereClause.id = { in: matchingPhotoIds };
      }
    }

    const [totalCount, photos] = await Promise.all([
      prisma.photo.count({
        where: whereClause,
      }),
      prisma.photo.findMany({
        where: whereClause,
        include: {
          asset: {
            select: {
              id: true,
              mimeType: true,
              byteSize: true,
              width: true,
              height: true,
              captureDate: true,
              storageKeyThumbnail: true,
              storageKeyPreview: true,
              storageKeyOriginal: true,
            },
          },
          uploadReferences: {
            include: {
              uploadedByUser: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              guestUploader: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
            orderBy: { uploadedAt: 'asc' },
          },
        },
        orderBy: [
          { asset: { captureDate: 'desc' } },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
    ]);

    // Prime the in-memory photo cache so subsequent thumbnail/preview requests require 0 database round-trips
    photoCache.setBatch(photos);

    const formattedPhotos = photos.map((p) => {
      const uploaderRef = p.uploadReferences[0];
      const uploaderName =
        uploaderRef?.uploadedByUser?.name ||
        uploaderRef?.uploadedByUser?.email ||
        uploaderRef?.guestUploader?.displayName ||
        'Anonymous';

      return {
        id: p.id,
        eventId: p.eventId,
        createdAt: p.createdAt,
        asset: {
          id: p.asset.id,
          mimeType: p.asset.mimeType,
          byteSize: p.asset.byteSize,
          width: p.asset.width,
          height: p.asset.height,
          captureDate: p.asset.captureDate,
        },
        primaryUploader: {
          id: uploaderRef?.uploadedByUser?.id || uploaderRef?.guestUploader?.id || null,
          name: uploaderName,
          image: uploaderRef?.uploadedByUser?.image || null,
          originalFilename: uploaderRef?.originalFilename,
        },
        uploaderCount: p.uploadReferences.length,
        thumbnailUrl: `/api/events/${eventId}/photos/${p.id}/thumbnail`,
        previewUrl: `/api/events/${eventId}/photos/${p.id}/preview`,
        downloadUrl: `/api/events/${eventId}/photos/${p.id}/original`,
      };
    });

    return NextResponse.json({
      photos: formattedPhotos,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + photos.length < totalCount,
      },
      matchCount: totalCount,
    });
  } catch (err: unknown) {
    console.error('[API photos GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to list photos' },
      { status: 500 }
    );
  }
}
