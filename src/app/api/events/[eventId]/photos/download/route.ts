import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { ZipArchive } from 'archiver';
import { PassThrough, Readable } from 'node:stream';

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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const photoIdsParam = searchParams.get('photoIds');
    const personIdsParam = searchParams.get('personIds');
    const mode = searchParams.get('mode') || 'all';

    let photoIdsToFetch: string[] | undefined;

    if (photoIdsParam) {
      photoIdsToFetch = photoIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
    } else if (personIdsParam) {
      const personIds = personIdsParam.split(',').map((id) => id.trim()).filter(Boolean);
      if (personIds.includes('none')) {
        const withFaces = await prisma.face.findMany({
          where: { photo: { eventId, isDeleted: false } },
          select: { photoId: true },
          distinct: ['photoId'],
        });
        const withFaceIds = withFaces.map((f) => f.photoId);
        const photosWithoutFaces = await prisma.photo.findMany({
          where: {
            eventId,
            isDeleted: false,
            id: { notIn: withFaceIds },
          },
          select: { id: true },
        });
        photoIdsToFetch = photosWithoutFaces.map((p) => p.id);
      } else if (personIds.length === 1) {
        const matchingFaces = await prisma.face.findMany({
          where: {
            personId: personIds[0],
            photo: { eventId, isDeleted: false },
          },
          select: { photoId: true },
          distinct: ['photoId'],
        });
        photoIdsToFetch = matchingFaces.map((f) => f.photoId);
      } else if (mode === 'all') {
        const rows = await prisma.$queryRaw<Array<{ photoId: string }>>`
          SELECT f."photoId"
          FROM "Face" f
          JOIN "Photo" p ON p.id = f."photoId"
          WHERE p."eventId" = ${eventId}
            AND p."isDeleted" = false
            AND f."personId" = ANY(${personIds})
          GROUP BY f."photoId"
          HAVING COUNT(DISTINCT f."personId") = ${personIds.length}
        `;
        photoIdsToFetch = rows.map((r) => r.photoId);
      } else {
        const matchingFaces = await prisma.face.findMany({
          where: {
            personId: { in: personIds },
            photo: { eventId, isDeleted: false },
          },
          select: { photoId: true },
          distinct: ['photoId'],
        });
        photoIdsToFetch = matchingFaces.map((f) => f.photoId);
      }
    }

    const photos = await prisma.photo.findMany({
      where: {
        eventId,
        isDeleted: false,
        ...(photoIdsToFetch ? { id: { in: photoIdsToFetch } } : {}),
      },
      include: {
        asset: true,
        uploadReferences: {
          take: 1,
          orderBy: { uploadedAt: 'asc' },
          select: { originalFilename: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (photos.length === 0) {
      return NextResponse.json({ error: 'No photos to download' }, { status: 404 });
    }

    const storage = getStorageProvider();
    const passThrough = new PassThrough();
    const archive = new ZipArchive({
      zlib: { level: 4 }, // Good speed / compression balance for images
    });

    archive.on('error', (err: Error) => {
      console.error('[ZIP archive error]:', err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    // Track duplicate filenames to keep all entries distinct in the ZIP
    const filenameCounts = new Map<string, number>();

    // Asynchronously add each photo buffer to the archive
    (async () => {
      try {
        for (const photo of photos) {
          if (!photo.asset.storageKeyOriginal) continue;
          const buffer = await storage.read(photo.asset.storageKeyOriginal);
          if (!buffer) continue;

          let filename =
            photo.uploadReferences[0]?.originalFilename ||
            `photo-${photo.id.substring(0, 8)}.jpg`;

          // Ensure valid filename
          filename = filename.replace(/[/\\?%*:|"<>]/g, '_');

          const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '.jpg';
          const base = filename.includes('.') ? filename.substring(0, filename.lastIndexOf('.')) : filename;

          const currentCount = filenameCounts.get(filename) || 0;
          filenameCounts.set(filename, currentCount + 1);

          const finalFilename = currentCount > 0 ? `${base} (${currentCount})${ext}` : filename;

          archive.append(buffer, { name: finalFilename });
        }
      } catch (err) {
        console.error('[ZIP stream error]:', err);
      } finally {
        await archive.finalize();
      }
    })();

    const sanitizedEventName = event.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const zipFilename = `${sanitizedEventName || 'gallery'}-photos.zip`;

    const webStream = Readable.toWeb(passThrough);

    return new NextResponse(webStream as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    console.error('[Download All Error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to generate ZIP download' },
      { status: 500 }
    );
  }
}
