'use client';

import React from 'react';
import Image from 'next/image';
import { GalleryPhoto } from '@/components/photos/PhotoThumbnailCard';

export interface PersonMeta {
  id: string;
  index: number;
  displayName: string;
  color: string;
  dotLabel: string;
  thumbnailUrl: string | null;
}

interface GalleryGridSectionProps {
  photos: GalleryPhoto[];
  totalPhotosCount: number;
  peopleMap: Map<string, PersonMeta>;
  isFilterActive: boolean;
  filterMode: 'together' | 'either';
  isSelectionMode: boolean;
  selectedPhotoIds: string[];
  isDownloadingZip: boolean;
  isPhotosLoading?: boolean;
  onToggleSelectionMode: () => void;
  onToggleSelectPhoto: (photoId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDownloadZip: () => void;
  onDeleteSelected: () => void;
  onPhotoClick: (photo: GalleryPhoto) => void;
}

export function GalleryGridSection({
  photos,
  totalPhotosCount,
  peopleMap,
  isFilterActive,
  filterMode,
  isSelectionMode,
  selectedPhotoIds,
  isDownloadingZip,
  isPhotosLoading = false,
  onToggleSelectionMode,
  onToggleSelectPhoto,
  onSelectAll,
  onDeselectAll,
  onDownloadZip,
  onDeleteSelected,
  onPhotoClick,
}: GalleryGridSectionProps) {
  const photoCount = photos.length;
  const countLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
  const selectedCount = selectedPhotoIds.length;
  const isAllSelected = photoCount > 0 && selectedCount === photoCount;

  const downloadLabel = isSelectionMode
    ? selectedCount > 0
      ? `Download (${selectedCount})`
      : 'Download (0)'
    : isFilterActive
      ? `Download ${photoCount}`
      : `Download all`;

  return (
    <section aria-labelledby="gl">
      <div className="gh">
        <h2 id="gl">Gallery</h2>
        <span className="tag" id="gc">
          {countLabel}
        </span>
        {isSelectionMode && selectedCount > 0 && (
          <span
            className="tag"
            style={{
              background: 'var(--tomato)',
              color: '#FFFFFF',
              fontWeight: 800,
            }}
          >
            {selectedCount} selected
          </span>
        )}

        <div className="tools">
          {isSelectionMode ? (
            <>
              <button
                className="btn sm white"
                type="button"
                id="selall"
                onClick={isAllSelected ? onDeselectAll : onSelectAll}
                disabled={photoCount === 0}
              >
                {isAllSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button
                className="btn alt"
                type="button"
                id="dl"
                onClick={onDownloadZip}
                disabled={isDownloadingZip || selectedCount === 0}
                style={{
                  opacity: selectedCount === 0 ? 0.6 : 1,
                  cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {isDownloadingZip ? 'Preparing ZIP…' : downloadLabel}
              </button>
              <button
                className="btn go"
                type="button"
                id="delbtn"
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
                className="btn sm"
                type="button"
                id="selbtn"
                aria-pressed={true}
                onClick={onToggleSelectionMode}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                className="btn alt"
                type="button"
                id="dl"
                onClick={onDownloadZip}
                disabled={isDownloadingZip || photoCount === 0}
              >
                {isDownloadingZip ? 'Preparing ZIP…' : downloadLabel}
              </button>
              <button
                className="btn sm"
                type="button"
                id="selbtn"
                aria-pressed={false}
                onClick={onToggleSelectionMode}
                disabled={photoCount === 0}
              >
                Select
              </button>
            </>
          )}
        </div>
      </div>

      {photoCount === 0 ? (
        isPhotosLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', fontWeight: 700, color: 'var(--muted)' }}>
            Finding matching photos…
          </div>
        ) : (
          <div className="none" id="none" style={{ display: 'block' }}>
            <h3>No photos match</h3>
            <p>
              {filterMode === 'together'
                ? 'Nobody was caught in a photo together yet. Try Either, or pick different people.'
                : 'No photos match this person filter yet. Try picking different people.'}
            </p>
          </div>
        )
      ) : (
        <ul
          className={`mosaic${isSelectionMode ? ' sm-on' : ''}`}
          id="mosaic"
          style={{ opacity: isPhotosLoading ? 0.6 : 1, transition: 'opacity .15s' }}
        >
          {photos.map((photo, idx) => {
            const isSelected = selectedPhotoIds.includes(photo.id);

            // Deduplicate person IDs present in this photo's faces
            const peopleInPhoto: PersonMeta[] = [];
            const seenPersonIds = new Set<string>();

            if (photo.faces) {
              for (const face of photo.faces) {
                if (face.personId && !seenPersonIds.has(face.personId)) {
                  seenPersonIds.add(face.personId);
                  const meta = peopleMap.get(face.personId);
                  if (meta) {
                    peopleInPhoto.push(meta);
                  }
                }
              }
            }

            // Sort ascending by person index (Person 1, Person 2, ...)
            peopleInPhoto.sort((a, b) => a.index - b.index);

            // Construct accessible label
            let tileAriaLabel = `Photo ${idx + 1}`;
            if (peopleInPhoto.length === 1) {
              tileAriaLabel = `Photo with ${peopleInPhoto[0].displayName}`;
            } else if (peopleInPhoto.length === 2) {
              tileAriaLabel = `Photo with ${peopleInPhoto[0].displayName} and ${peopleInPhoto[1].displayName}`;
            } else if (peopleInPhoto.length > 2) {
              const names = peopleInPhoto.map((p) => p.displayName);
              tileAriaLabel = `Photo with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
            }

            const visibleDots = peopleInPhoto.slice(0, 3);
            const overflowCount = peopleInPhoto.length - 3;

            return (
              <li key={photo.id}>
                <button
                  className="ph-t"
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={tileAriaLabel}
                  onClick={() => {
                    if (isSelectionMode) {
                      onToggleSelectPhoto(photo.id);
                    } else {
                      onPhotoClick(photo);
                    }
                  }}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.primaryUploader?.originalFilename || `Photo ${idx + 1}`}
                    loading="lazy"
                  />

                  {/* Numbered person marker dots */}
                  {peopleInPhoto.length > 0 && (
                    <span className="who" aria-hidden="true">
                      {visibleDots.map((person) => (
                        <i
                          key={person.id}
                          style={{ ['--c' as any]: person.color }}
                        >
                          {person.dotLabel}
                        </i>
                      ))}
                      {overflowCount > 0 && (
                        <i style={{ ['--c' as any]: '#FFFFFF' }}>
                          +{overflowCount}
                        </i>
                      )}
                    </span>
                  )}

                  {/* Selection check indicator */}
                  <span className="ck">✓</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
