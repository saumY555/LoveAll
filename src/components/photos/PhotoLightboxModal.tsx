/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  User as UserIcon,
  Maximize2,
  Loader2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { GalleryPhoto } from './PhotoThumbnailCard';
import { formatDate, formatDateTime, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface PhotoLightboxModalProps {
  photos: GalleryPhoto[];
  currentPhoto: GalleryPhoto | null;
  onClose: () => void;
  onNavigate: (photo: GalleryPhoto) => void;
}

export function PhotoLightboxModal({
  photos,
  currentPhoto,
  onClose,
  onNavigate,
}: PhotoLightboxModalProps) {
  const [loadedPhotoId, setLoadedPhotoId] = useState<string | null>(null);
  const [fullResPhotoId, setFullResPhotoId] = useState<string | null>(null);

  const isFullRes = currentPhoto ? fullResPhotoId === currentPhoto.id : false;
  const targetPhotoKey = currentPhoto ? (isFullRes ? `${currentPhoto.id}-full` : currentPhoto.id) : '';
  const isImageLoaded = currentPhoto ? loadedPhotoId === targetPhotoKey : false;
  const isFullResLoading = isFullRes && !isImageLoaded;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!currentPhoto) return;
      const currentIndex = photos.findIndex((p) => p.id === currentPhoto.id);
      if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) {
        onNavigate(photos[currentIndex + 1]);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(photos[currentIndex - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos, currentPhoto, onClose, onNavigate]);

  if (!currentPhoto) return null;

  const currentIndex = photos.findIndex((p) => p.id === currentPhoto.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  const activeImageUrl = isFullRes
    ? `${currentPhoto.previewUrl}?full=true`
    : currentPhoto.previewUrl;

  const handleToggleFullRes = () => {
    if (!isFullRes) {
      setFullResPhotoId(currentPhoto.id);
    } else {
      setFullResPhotoId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-150 select-none">
      {/* Top Header Bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-20 bg-gradient-to-b from-black/85 via-black/50 to-transparent text-white">
        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-zinc-300">
            {currentIndex + 1} / {photos.length}
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="text-xs text-zinc-300 truncate max-w-xs sm:max-w-md font-mono">
            {currentPhoto.primaryUploader.originalFilename || 'Photo'}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Resolution Mode Switcher: Fast Preview vs Full Resolution */}
          <button
            onClick={handleToggleFullRes}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              isFullRes
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'bg-white/10 hover:bg-white/20 text-zinc-200 border border-white/10'
            }`}
            title={
              isFullRes
                ? 'Currently showing pristine full resolution. Click for fast low-res preview.'
                : 'Default: Fast lightweight preview. Click to load full pristine resolution.'
            }
          >
            {isFullResLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
            ) : isFullRes ? (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            )}
            <span className="hidden sm:inline">
              {isFullRes ? 'Full Resolution' : 'Fast Preview'}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                isFullRes
                  ? 'bg-amber-400 text-black'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {isFullRes ? 'HD' : 'FAST'}
            </span>
          </button>

          {/* Download Original Button (always highest quality uncompressed) */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.open(currentPhoto.downloadUrl, '_blank')}
            className="gap-1.5 bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer"
            title="Download full quality original file"
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Download Original</span>
          </Button>

          {/* Close Lightbox */}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Chevrons */}
      {hasPrev && (
        <button
          onClick={() => onNavigate(photos[currentIndex - 1])}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 transition-transform active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm"
          title="Previous photo (Left arrow)"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={() => onNavigate(photos[currentIndex + 1])}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-30 rounded-full bg-black/60 p-3 text-white hover:bg-black/90 transition-transform active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm"
          title="Next photo (Right arrow)"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Main Viewport Container */}
      <div className="relative max-w-6xl max-h-[82vh] w-full h-full flex items-center justify-center p-4">
        {/* Instant Progressive Blur-Up Placeholder:
            Uses the already-cached thumbnail immediately (0ms delay) while preview or full res loads */}
        <img
          src={currentPhoto.thumbnailUrl}
          alt=""
          aria-hidden="true"
          className={`absolute max-w-full max-h-[82vh] object-contain rounded-lg filter blur-lg scale-102 transition-opacity duration-300 pointer-events-none ${
            isImageLoaded ? 'opacity-0' : 'opacity-70'
          }`}
        />

        {/* Loading Spinner for full res or initial connection */}
        {!isImageLoaded && (
          <div className="absolute z-20 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-3.5 py-1.5 text-xs text-zinc-200 shadow-md">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>{isFullRes ? 'Loading full resolution (HD)...' : 'Loading fast preview...'}</span>
          </div>
        )}

        {/* Active Display Image */}
        <img
          key={activeImageUrl}
          src={activeImageUrl}
          alt={currentPhoto.primaryUploader.originalFilename || 'Preview'}
          onLoad={() => {
            if (targetPhotoKey) setLoadedPhotoId(targetPhotoKey);
          }}
          className={`relative z-10 max-w-full max-h-[82vh] object-contain rounded-lg transition-opacity duration-200 ${
            isImageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>

      {/* Bottom Metadata & Speed Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent text-white z-20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Uploader Attribution */}
        <div className="flex items-center gap-2.5">
          {currentPhoto.primaryUploader.image ? (
            <img
              src={currentPhoto.primaryUploader.image}
              alt=""
              className="h-6 w-6 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
          )}
          <span>
            Uploaded by <strong className="font-semibold">{currentPhoto.primaryUploader.name}</strong>
          </span>
        </div>

        {/* Speed & Resolution Indicator */}
        <div className="flex items-center gap-4 text-zinc-400">
          <div className="flex items-center gap-1.5">
            {isFullRes ? (
              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                <Sparkles className="w-3 h-3" /> Full Resolution Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Zap className="w-3 h-3" /> Fast Low-Res Active
              </span>
            )}
          </div>

          {currentPhoto.asset.captureDate ? (
            <div className="flex items-center gap-1.5" title="Capture Date">
              <Calendar className="w-3.5 h-3.5" />
              <span>Captured {formatDateTime(currentPhoto.asset.captureDate)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5" title="Upload Date">
              <Calendar className="w-3.5 h-3.5" />
              <span>Uploaded {formatDate(currentPhoto.createdAt)}</span>
            </div>
          )}

          {currentPhoto.asset.width && currentPhoto.asset.height && (
            <div className="flex items-center gap-1.5" title="Original Dimensions">
              <Maximize2 className="w-3.5 h-3.5" />
              <span>
                {currentPhoto.asset.width} × {currentPhoto.asset.height}
              </span>
            </div>
          )}

          <div title="Original File Size">{formatBytes(currentPhoto.asset.byteSize)}</div>
        </div>
      </div>
    </div>
  );
}
