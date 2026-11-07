'use client';

import React from 'react';
import Image from 'next/image';
import { GalleryPhoto } from '@/components/photos/PhotoThumbnailCard';

interface PersonMeta {
  id: string;
  index: number;
  displayName: string;
  color: string;
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
  onToggleSelectionMode: () => void;
  onToggleSelectPhoto: (photoId: string) => void;
  onDownloadZip: () => void;
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
  onToggleSelectionMode,
  onToggleSelectPhoto,
  onDownloadZip,
  onPhotoClick,
}: GalleryGridSectionProps) {
  const photoCount = photos.length;
  const countLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
  const downloadLabel = isFilterActive
    ? `Download ${photoCount}`
    : `Download all`;

  return (
    <section aria-labelledby="gl">
      <div className="gh">
        <h2 id="gl">Gallery</h2>
        <span className="tag" id="gc">
          {countLabel}
        </span>

        <div className="tools">
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
            aria-pressed={isSelectionMode}
            onClick={onToggleSelectionMode}
          >
            {isSelectionMode ? 'Done' : 'Select'}
          </button>
        </div>
      </div>

      {photoCount === 0 ? (
        <div className="none" id="none" style={{ display: 'block' }}>
          <h3>No photos match</h3>
          <p>
            {filterMode === 'together'
              ? 'Nobody was caught in a photo together yet. Try Either, or pick different people.'
              : 'No photos match this person filter yet. Try picking different people.'}
          </p>
        </div>
      ) : (
        <ul className={`mosaic${isSelectionMode ? ' sm-on' : ''}`} id="mosaic">
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

            return (
              <li key={photo.id}>
                <button
                  className="ph-t"
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`Photo ${idx + 1}`}
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

                  {/* Who was in this photo dots */}
                  {peopleInPhoto.length > 0 && (
                    <span className="who">
                      {peopleInPhoto.slice(0, 4).map((person) => (
                        <i
                          key={person.id}
                          style={{ ['--c' as any]: person.color }}
                          title={person.displayName}
                        >
                          {person.thumbnailUrl ? (
                            <img src={person.thumbnailUrl} alt="" />
                          ) : (
                            person.index
                          )}
                        </i>
                      ))}
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
