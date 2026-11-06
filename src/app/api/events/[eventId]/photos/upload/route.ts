import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { getStorageProvider } from '@/lib/storage';
import { computeSha256 } from '@/lib/utils';
import { processPhotoBuffer } from '@/lib/imageProcessor';

// Maximum allowed photo size: 50MB
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
  'image/jpg',
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const session = await getAuthSession();
  const userId = session?.user?.id;

  const guestToken = req.cookies.get(`guest_token_${eventId}`)?.value || req.headers.get('x-guest-token');

  // Verify access permissions (supports registered members and temporary guests)
  const access = await checkEventAccess(eventId, userId, { guestToken });
  if (!access.hasAccess || !access.event) {
    return NextResponse.json(
      { error: access.error || 'Access denied' },
      { status: access.statusCode || 403 }
    );
  }

  // Check upload permissions: Registered members always have upload access.
  // Guests have upload access if permitted by share link or event settings
  const canUpload = !!access.role || (access.isGuest ? access.canGuestUpload : access.event.allowGuestUpload);
  if (!canUpload) {
    return NextResponse.json(
      { error: 'You do not have permission to upload photos to this event' },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided in request' }, { status: 400 });
    }

    const storage = getStorageProvider();
    const uploadedPhotos = [];
    const errors: { filename: string; reason: string }[] = [];

    for (const file of files) {
      const filename = file.name || 'unnamed-photo.jpg';

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push({ filename, reason: 'File exceeds maximum 50MB size limit' });
        continue;
      }

      const mimeType = file.type || 'image/jpeg';
      if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase()) && !mimeType.startsWith('image/')) {
        errors.push({ filename, reason: `Unsupported file format: ${mimeType}` });
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileHash = computeSha256(buffer);

        // 1. Check if physical PhotoAsset already exists (Safe Deduplication)
        let asset = await prisma.photoAsset.findUnique({
          where: { fileHash },
        });

        if (!asset) {
          // New physical asset: process with Sharp
          const processed = await processPhotoBuffer(buffer, mimeType);

          const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
          const originalKey = `originals/${fileHash}.${ext}`;
          const previewKey = `previews/${fileHash}.webp`;
          const thumbnailKey = `thumbnails/${fileHash}.webp`;

          // Save physical files to private storage
          await storage.save(originalKey, buffer, { mimeType });
          await storage.save(previewKey, processed.previewBuffer, { mimeType: 'image/webp' });
          await storage.save(thumbnailKey, processed.thumbnailBuffer, { mimeType: 'image/webp' });

          asset = await prisma.photoAsset.create({
            data: {
              fileHash,
              storageKeyOriginal: originalKey,
              storageKeyPreview: previewKey,
              storageKeyThumbnail: thumbnailKey,
              mimeType: processed.mimeType,
              byteSize: processed.byteSize,
              width: processed.width,
              height: processed.height,
              captureDate: processed.captureDate,
            },
          });
        }

        // 2. Link asset to the logical event Photo record
        let photo = await prisma.photo.findUnique({
          where: {
            eventId_assetId: {
              eventId,
              assetId: asset.id,
            },
          },
        });

        if (!photo) {
          photo = await prisma.photo.create({
            data: {
              eventId,
              assetId: asset.id,
              isDeleted: false,
              faceStatus: 'PENDING',
            },
          });
        } else if (photo.isDeleted) {
          // Re-activate if was previously soft-deleted in this event
          photo = await prisma.photo.update({
            where: { id: photo.id },
            data: { isDeleted: false, deletedAt: null, faceStatus: 'PENDING', faceError: null },
          });
        }

        // 3. Record upload attribution / provenance (user or guest)
        await prisma.photoUploadReference.create({
          data: {
            photoId: photo.id,
            uploadedByUserId: userId || null,
            guestUploaderId: access.isGuest && access.guestIdentity ? access.guestIdentity.id : null,
            originalFilename: filename,
          },
        });

        uploadedPhotos.push({
          id: photo.id,
          eventId: photo.eventId,
          assetId: asset.id,
          width: asset.width,
          height: asset.height,
          captureDate: asset.captureDate,
          createdAt: photo.createdAt,
          originalFilename: filename,
        });
      } catch (fileErr: unknown) {
        errors.push({ filename, reason: (fileErr as Error).message });
      }
    }

    return NextResponse.json(
      {
        success: uploadedPhotos.length > 0,
        uploadedCount: uploadedPhotos.length,
        photos: uploadedPhotos,
        errors,
      },
      { status: uploadedPhotos.length > 0 ? 201 : 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to process uploads' },
      { status: 500 }
    );
  }
}
