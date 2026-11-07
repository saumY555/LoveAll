'use client';

import React from 'react';
import { formatDate } from '@/lib/utils';
import { EventWithRole } from '@/types';

interface EventHeaderSectionProps {
  event: EventWithRole;
  photoCount: number;
  peopleCount: number;
  isOwner: boolean;
  canUpload: boolean;
  onOpenMembers: () => void;
  onOpenShare: () => void;
  onOpenSettings: () => void;
  onOpenUpload: () => void;
}

export function EventHeaderSection({
  event,
  photoCount,
  peopleCount,
  isOwner,
  canUpload,
  onOpenMembers,
  onOpenShare,
  onOpenSettings,
  onOpenUpload,
}: EventHeaderSectionProps) {
  const roleLabel = isOwner ? 'Host and owner' : 'Member';
  const dateLabel = event.eventDate ? formatDate(event.eventDate) : 'No date set';
  const peopleLabel = `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'}`;
  const photoLabel = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;

  return (
    <section className="hd">
      <div>
        <h1>
          <span>{event.name}</span>
          <span className="tag">{roleLabel}</span>
        </h1>
        <div className="meta">
          <span>{dateLabel}</span>
          <span>{peopleLabel}</span>
          <span>{photoLabel}</span>
        </div>
      </div>

      <div className="acts">
        <button type="button" className="btn sm" onClick={onOpenMembers}>
          Members
        </button>
        <button type="button" className="btn sm" onClick={onOpenShare}>
          Share and QR
        </button>
        {isOwner && (
          <button type="button" className="btn sm" onClick={onOpenSettings}>
            Settings
          </button>
        )}
        {canUpload && (
          <button type="button" className="btn go" onClick={onOpenUpload}>
            Upload photos
          </button>
        )}
      </div>
    </section>
  );
}
