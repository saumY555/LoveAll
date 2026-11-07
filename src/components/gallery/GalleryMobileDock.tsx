'use client';

import React from 'react';

interface GalleryMobileDockProps {
  onUploadPhotos: () => void;
  onDownloadAll: () => void;
  isDownloading: boolean;
  canUpload: boolean;
  isSelectionMode?: boolean;
  selectedCount?: number;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDownloadSelected?: () => void;
  onDeleteSelected?: () => void;
  onExitSelectionMode?: () => void;
}

export function GalleryMobileDock({
  onUploadPhotos,
  onDownloadAll,
  isDownloading,
  canUpload,
  isSelectionMode = false,
  selectedCount = 0,
  isAllSelected = false,
  onSelectAll,
  onDeselectAll,
  onDownloadSelected,
  onDeleteSelected,
  onExitSelectionMode,
}: GalleryMobileDockProps) {
  if (isSelectionMode) {
    return (
      <nav className="dock selection-dock" aria-label="Selection actions">
        <button
          type="button"
          className="btn sm white"
          onClick={isAllSelected ? onDeselectAll : onSelectAll}
        >
          {isAllSelected ? 'Deselect all' : 'Select all'}
        </button>

        <button
          type="button"
          className="btn alt"
          onClick={onDownloadSelected}
          disabled={isDownloading || selectedCount === 0}
          style={{
            opacity: selectedCount === 0 ? 0.6 : 1,
            cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {isDownloading ? 'Preparing…' : `Download (${selectedCount})`}
        </button>

        <button
          type="button"
          className="btn go"
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          style={{
            opacity: selectedCount === 0 ? 0.5 : 1,
            cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Delete ({selectedCount})
        </button>

        <button
          type="button"
          className="btn sm"
          onClick={onExitSelectionMode}
        >
          Done
        </button>
      </nav>
    );
  }

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
