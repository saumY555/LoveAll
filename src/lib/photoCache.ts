export interface CachedPhotoMetadata {
  id: string;
  storageKeyThumbnail: string | null;
  storageKeyPreview: string | null;
  storageKeyOriginal: string | null;
  mimeType: string;
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

// In-memory cache with 5-minute TTL to eliminate database lookups on image rendering
const assetCache = new Map<string, CacheItem<CachedPhotoMetadata>>();

export const photoCache = {
  get(photoId: string): CachedPhotoMetadata | null {
    const item = assetCache.get(photoId);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      assetCache.delete(photoId);
      return null;
    }
    return item.value;
  },

  set(photoId: string, metadata: CachedPhotoMetadata, ttlMs = 300_000): void {
    assetCache.set(photoId, {
      value: metadata,
      expiresAt: Date.now() + ttlMs,
    });
  },

  setBatch(
    items: Array<{
      id: string;
      asset: {
        storageKeyThumbnail?: string | null;
        storageKeyPreview?: string | null;
        storageKeyOriginal?: string | null;
        mimeType: string;
      };
    }>
  ): void {
    const now = Date.now();
    const expiresAt = now + 300_000; // 5 minutes
    for (const item of items) {
      assetCache.set(item.id, {
        value: {
          id: item.id,
          storageKeyThumbnail: item.asset.storageKeyThumbnail ?? null,
          storageKeyPreview: item.asset.storageKeyPreview ?? null,
          storageKeyOriginal: item.asset.storageKeyOriginal ?? null,
          mimeType: item.asset.mimeType,
        },
        expiresAt,
      });
    }
  },

  delete(photoId: string): void {
    assetCache.delete(photoId);
  },
};
