import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { photoCache } from '@/lib/photoCache';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  try {
    const { eventId, photoId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    // Fast cached permission check (0ms)
    const guestToken = req.cookies.get(`guest_token_${eventId}`)?.value || req.headers.get('x-guest-token');
    const access = await checkEventAccess(eventId, userId, { guestToken });
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const isFullRequested = req.nextUrl.searchParams.get('full') === 'true';

    // Fast in-memory cache lookup (0ms)
    let storageKey: string | null = null;
    let mimeType = 'image/webp';
    const cached = photoCache.get(photoId);

    if (cached) {
      storageKey = isFullRequested ? cached.storageKeyOriginal : cached.storageKeyPreview;
      mimeType = isFullRequested ? cached.mimeType : 'image/webp';
    } else {
      const photo = await prisma.photo.findUnique({
        where: { id: photoId, eventId, isDeleted: false },
        include: { asset: true },
      });

      if (!photo) {
        return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
      }

      photoCache.set(photoId, {
        id: photoId,
        storageKeyThumbnail: photo.asset.storageKeyThumbnail,
        storageKeyPreview: photo.asset.storageKeyPreview,
        storageKeyOriginal: photo.asset.storageKeyOriginal,
        mimeType: photo.asset.mimeType,
      });

      storageKey = isFullRequested ? photo.asset.storageKeyOriginal : photo.asset.storageKeyPreview;
      mimeType = isFullRequested ? photo.asset.mimeType : 'image/webp';
    }

    if (!storageKey) {
      return NextResponse.json({ error: 'Photo asset key missing' }, { status: 404 });
    }

    const storage = getStorageProvider();
    const buffer = await storage.read(storageKey);

    if (!buffer) {
      return NextResponse.json({ error: 'Photo file missing from storage' }, { status: 404 });
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: unknown) {
    console.error('[API preview GET error]:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to serve preview' },
      { status: 500 }
    );
  }
}
