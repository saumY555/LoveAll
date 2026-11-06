import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; photoId: string }> }
) {
  const { eventId, photoId } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id;

  const access = await checkEventAccess(eventId, userId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const photo = await prisma.photo.findUnique({
    where: { id: photoId, eventId, isDeleted: false },
    include: {
      asset: true,
      uploadReferences: { take: 1, orderBy: { uploadedAt: 'asc' } },
    },
  });

  if (!photo || !photo.asset.storageKeyOriginal) {
    return NextResponse.json({ error: 'Original photo not found' }, { status: 404 });
  }

  const storage = getStorageProvider();
  const buffer = await storage.read(photo.asset.storageKeyOriginal);

  if (!buffer) {
    return NextResponse.json({ error: 'File missing from storage' }, { status: 404 });
  }

  const filename = photo.uploadReferences[0]?.originalFilename || `photo-${photo.id}.jpg`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': photo.asset.mimeType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
