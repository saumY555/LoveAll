import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { photoCache } from '@/lib/photoCache';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  try {
    const { eventId, photoId } = await params;
    const session = await getAuthSession();
    const userId = session?.user?.id;

    // Fast cached permission check (resolves in 0ms during gallery viewing bursts)
    const guestToken = _req.cookies.get(`guest_token_${eventId}`)?.value || _req.headers.get('x-guest-token');
    const access = await checkEventAccess(eventId, userId, { guestToken });
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fast in-memory cache lookup (0ms)
    let storageKeyThumbnail: string | null = null;
    const cached = photoCache.get(photoId);

    if (cached) {
      storageKeyThumbnail = cached.storageKeyThumbnail;
    } else {
      // Fallback query if cache missed
      const photo = await prisma.photo.findUnique({
        where: { id: photoId, eventId, isDeleted: false },
        include: { asset: true },
      });

      if (!photo || !photo.asset.storageKeyThumbnail) {
        return NextResponse.json({ error: 'Photo thumbnail not found' }, { status: 404 });
      }

      storageKeyThumbnail = photo.asset.storageKeyThumbnail;
      photoCache.set(photoId, {
        id: photoId,
        storageKeyThumbnail: photo.asset.storageKeyThumbnail,
        storageKeyPreview: photo.asset.storageKeyPreview,
        storageKeyOriginal: photo.asset.storageKeyOriginal,
        mimeType: photo.asset.mimeType,
      });
    }

    if (!storageKeyThumbnail) {
      return NextResponse.json({ error: 'Thumbnail key missing' }, { status: 404 });
    }

    const storage = getStorageProvider();
    const buffer = await storage.read(storageKeyThumbnail);

    if (!buffer) {
      return NextResponse.json({ error: 'Thumbnail file missing from storage' }, { status: 404 });
    }

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch (err: unknown) {
    console.error('[API thumbnail GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to serve thumbnail' },
      { status: 500 }
    );
  }
}
