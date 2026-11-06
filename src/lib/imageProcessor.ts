import sharp from 'sharp';

export interface ProcessedImageResult {
  width?: number;
  height?: number;
  mimeType: string;
  byteSize: number;
  captureDate?: Date;
  previewBuffer: Buffer;
  thumbnailBuffer: Buffer;
}

/**
 * Extract EXIF capture date from raw EXIF buffer if available
 */
function extractExifDate(exifBuffer?: Buffer): Date | undefined {
  if (!exifBuffer || exifBuffer.length === 0) return undefined;

  try {
    const exifString = exifBuffer.toString('binary');
    // Standard EXIF date format is "YYYY:MM:DD HH:MM:SS"
    const match = exifString.match(/\b(19\d\d|20\d\d):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})\b/);
    if (match) {
      const [, year, month, day, hours, minutes, seconds] = match;
      const parsedDate = new Date(
        Date.UTC(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
          parseInt(hours, 10),
          parseInt(minutes, 10),
          parseInt(seconds, 10)
        )
      );
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
  } catch {
    // If parsing fails, fall back to undefined (upload time will be used)
  }
  return undefined;
}

/**
 * Process an uploaded raw photo:
 * 1. Extract metadata and EXIF capture date
 * 2. Generate a fast, lightweight 960px WebP preview for instant snappy viewing
 * 3. Generate a fast 300px WebP square thumbnail for gallery grid
 * (Full resolution pristine image is preserved untouched for downloads and on-demand HD viewing)
 */
export async function processPhotoBuffer(
  inputBuffer: Buffer,
  fallbackMimeType = 'image/jpeg'
): Promise<ProcessedImageResult> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const width = metadata.width;
  const height = metadata.height;
  const mimeType = metadata.format ? `image/${metadata.format}` : fallbackMimeType;
  const byteSize = inputBuffer.length;
  const captureDate = extractExifDate(metadata.exif);

  // Fast low-res preview WebP (auto-rotated based on EXIF orientation)
  // 960px max bound at quality 72 gives lightweight 35KB-60KB payloads for near-instant loads
  const previewBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 960,
      height: 960,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 72, effort: 2 })
    .toBuffer();

  // Fast 300px square cover thumbnail WebP (auto-rotated)
  const thumbnailBuffer = await sharp(inputBuffer)
    .rotate()
    .resize({
      width: 300,
      height: 300,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 75, effort: 2 })
    .toBuffer();

  return {
    width,
    height,
    mimeType,
    byteSize,
    captureDate,
    previewBuffer,
    thumbnailBuffer,
  };
}
