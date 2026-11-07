'use client';

import React from 'react';

interface GalleryMobileDockProps {
  onUploadPhotos: () => void;
  onDownloadAll: () => void;
  isDownloading: boolean;
  canUpload: boolean;
}

export function GalleryMobileDock({
  onUploadPhotos,
  onDownloadAll,
  isDownloading,
  canUpload,
}: GalleryMobileDockProps) {
  return (
    <nav className="dock" aria-label="Quick actions">
      {canUpload && (
        <button type="button" className="btn go" onClick={onUploadPhotos}>
          Upload photos
        </button>
      )}
      <button
        type="button"
        className="btn alt"
        id="dl2"
        onClick={onDownloadAll}
        disabled={isDownloading}
      >
        {isDownloading ? 'Preparing…' : 'Download all'}
      </button>
    </nav>
  );
}
