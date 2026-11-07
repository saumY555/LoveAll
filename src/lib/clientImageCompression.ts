/**
 * Client-side image compression utility (WhatsApp-style)
 * Resizes large photos to a max dimension of 2048px and compresses to high-efficiency JPEG (quality ~0.82).
 * Drastically speeds up mobile/network uploads while preserving great visual quality and face detection accuracy.
 */

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
}

export async function compressImageClientSide(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const maxDimension = options.maxDimension ?? 2048;
  const quality = options.quality ?? 0.82;

  // Only compress raster photo formats
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return file;
  }

  // If file is already smaller than 350KB, no need to compress further
  if (file.size < 350 * 1024) {
    return file;
  }

  try {
    return await new Promise<File>((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // If dimensions are already within limit and under 800KB, keep original
        if (width <= maxDimension && height <= maxDimension && file.size < 800 * 1024) {
          resolve(file);
          return;
        }

        // Maintain aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compressed blob is somehow not smaller, keep original
              resolve(file);
              return;
            }

            const ext = file.name.split('.').pop() || 'jpg';
            const baseName =
              file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const compressedFile = new File([blob], `${baseName}.${ext}`, {
              type: blob.type || 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };

      img.src = objectUrl;
    });
  } catch (err) {
    console.warn('[compressImageClientSide] Fallback to original due to error:', err);
    return file;
  }
}
