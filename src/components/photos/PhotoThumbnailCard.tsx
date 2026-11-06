/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Download, Trash2, Check, Sparkles } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface GalleryPhoto {
  id: string;
  eventId: string;
  createdAt: string;
  asset: {
    id: string;
    mimeType: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    captureDate: string | null;
  };
  primaryUploader: {
    id: string | null;
    name: string;
    image: string | null;
    originalFilename?: string;
  };
  uploaderCount: number;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
}

interface PhotoThumbnailCardProps {
  photo: GalleryPhoto;
  isOwner: boolean;
  currentUserId?: string;
  onPhotoClick: (photo: GalleryPhoto) => void;
  onPhotoDeleted: (photoId: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (photoId: string) => void;
}

export function PhotoThumbnailCard({
  photo,
  isOwner,
  currentUserId,
  onPhotoClick,
  onPhotoDeleted,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: PhotoThumbnailCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const canDelete = isOwner || (currentUserId && photo.primaryUploader.id === currentUserId);

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      onToggleSelect?.(photo.id);
    } else {
      onPhotoClick(photo);
    }
  };

  const handleSelectBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(photo.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this photo from the event?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/events/${photo.eventId}/photos/${photo.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete photo');

      onPhotoDeleted(photo.id);
    } catch (err: unknown) {
      alert((err as Error).message);
      setIsDeleting(false);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(photo.downloadUrl, '_blank');
  };

  const displayDate = photo.asset.captureDate || photo.createdAt;

  return (
    <div
      onClick={handleClick}
      className={`group relative flex flex-col overflow-hidden rounded-3xl bg-stone-100 border-2 transition-all duration-200 cursor-pointer dark:bg-stone-800 aspect-square select-none hover:-translate-y-0.5 ${
        isSelected
          ? 'ring-4 ring-pink-400 border-pink-400 scale-[0.98] shadow-lg shadow-pink-500/15'
          : 'border-stone-200/80 hover:shadow-md hover:border-purple-300 dark:border-stone-750 dark:hover:border-purple-700'
      }`}
    >
      {/* Cute Selection Badge */}
      <div
        onClick={handleSelectBadgeClick}
        className={`absolute top-2.5 left-2.5 z-20 transition-all duration-150 ${
          isSelectionMode || isSelected
            ? 'opacity-100 scale-100'
            : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
        }`}
      >
        <button
          type="button"
          aria-label={isSelected ? 'Deselect photo' : 'Select photo'}
          className={`h-7.5 w-7.5 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isSelected
              ? 'bg-gradient-to-tr from-pink-500 to-purple-500 text-white shadow-md shadow-pink-500/30 scale-105 ring-2 ring-white dark:ring-stone-900'
              : 'bg-stone-900/50 backdrop-blur-md border-2 border-white/90 hover:bg-stone-900/70 text-transparent'
          }`}
        >
          <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
        </button>
      </div>

      {/* Selected tint overlay with soft pink glow */}
      {isSelected && (
        <div className="absolute inset-0 bg-pink-500/12 z-10 pointer-events-none" />
      )}

      {/* Thumbnail Image */}
      <img
        src={photo.thumbnailUrl}
        alt={photo.primaryUploader.originalFilename || 'Event photo'}
        loading="lazy"
        onLoad={() => setImageLoaded(true)}
        className={`h-full w-full object-cover transition-all duration-300 group-hover:scale-105 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Loading Skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-purple-50 to-amber-50 animate-pulse dark:from-stone-800 dark:to-stone-750" />
      )}

      {/* Top Right Actions (Download & Single Delete - hidden in selection mode) */}
      {!isSelectionMode && (
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
          <button
            onClick={handleDownload}
            title="Download original"
            className="rounded-full bg-stone-900/60 backdrop-blur-md p-2 text-white hover:bg-stone-900/85 hover:scale-110 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete photo"
              className="rounded-full bg-rose-600/80 backdrop-blur-md p-2 text-white hover:bg-rose-600 hover:scale-110 transition-all cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Bottom Metadata Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-transparent p-3 pt-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 pointer-events-none">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className="truncate max-w-[70%]">
            {photo.primaryUploader.name || 'Anonymous'}
          </span>
          <span className="text-stone-300 text-[10px]">
            {formatDate(displayDate)}
          </span>
        </div>
      </div>
    </div>
  );
}
