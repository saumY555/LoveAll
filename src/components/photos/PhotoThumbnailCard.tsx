/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Download, Trash2, Calendar, User as UserIcon, Check } from 'lucide-react';
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
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-zinc-100 border transition-all duration-200 cursor-pointer dark:bg-zinc-800 aspect-square select-none ${
        isSelected
          ? 'ring-3 ring-indigo-600 dark:ring-indigo-500 border-indigo-500 scale-[0.98] shadow-md'
          : 'border-zinc-200/80 hover:shadow-md hover:border-zinc-300 dark:border-zinc-700/80 dark:hover:border-zinc-600'
      }`}
    >
      {/* Selection Badge: always visible in selection mode; on hover/tap in normal mode */}
      <div
        onClick={handleSelectBadgeClick}
        className={`absolute top-2 left-2 z-20 transition-all duration-150 ${
          isSelectionMode || isSelected
            ? 'opacity-100 scale-100'
            : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
        }`}
      >
        <button
          type="button"
          aria-label={isSelected ? 'Deselect photo' : 'Select photo'}
          className={`h-7 w-7 rounded-full flex items-center justify-center transition-all shadow-sm ${
            isSelected
              ? 'bg-indigo-600 text-white ring-2 ring-white dark:ring-zinc-900 scale-105'
              : 'bg-black/35 backdrop-blur-md border border-white/80 hover:bg-black/50 text-transparent'
          }`}
        >
          <Check className={`w-4 h-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
        </button>
      </div>

      {/* Selected tint overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-indigo-600/15 z-10 pointer-events-none" />
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
        <div className="absolute inset-0 bg-zinc-200 animate-pulse dark:bg-zinc-800" />
      )}

      {/* Top Right Actions (Download & Single Delete - hidden in selection mode) */}
      {!isSelectionMode && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-20">
          <button
            onClick={handleDownload}
            title="Download original"
            className="rounded-lg bg-black/60 backdrop-blur-md p-1.5 text-white hover:bg-black/80 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              title="Delete photo"
              className="rounded-lg bg-red-600/80 backdrop-blur-md p-1.5 text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Bottom Metadata Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 pt-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 pointer-events-none">
        <div className="flex items-center justify-between text-[11px]">
          {/* Uploader */}
          <div className="flex items-center gap-1.5 truncate max-w-[65%]">
            {photo.primaryUploader.image ? (
              <img
                src={photo.primaryUploader.image}
                alt=""
                className="h-4 w-4 rounded-full object-cover"
              />
            ) : (
              <UserIcon className="h-3.5 w-3.5 text-zinc-300" />
            )}
            <span className="truncate">{photo.primaryUploader.name}</span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1 text-[10px] text-zinc-300">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(displayDate)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
