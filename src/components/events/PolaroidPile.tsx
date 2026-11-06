'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Camera } from 'lucide-react';
import { EventWithRole } from '@/types';

interface PolaroidPileProps {
  event: EventWithRole;
  onOpenCoverPicker: (event: EventWithRole) => void;
  index: number;
}

export function PolaroidPile({ event, onOpenCoverPicker }: PolaroidPileProps) {
  const photoCount = event._count?.photos || 0;
  const memberCount = event._count?.members || 1;
  const roleLabel = event.userRole === 'OWNER' ? 'Host' : 'Member';

  // Format date like "Feb 22, 2022" or "No date"
  const formattedDate = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No date';

  return (
    <li className="li">
      <div className="pile-wrap">
        {/* Visual stack container */}
        <div className="pics-container">
          <Link
            href={`/events/${event.id}`}
            className="pile-image-link"
            aria-label={`Open ${event.name} gallery`}
          >
            <div className="pics">
              {/* Back Polaroid 1 */}
              <div className="p p-back-1" aria-hidden="true" />

              {/* Back Polaroid 2 */}
              <div className="p p-back-2" aria-hidden="true" />

              {/* Front Top Polaroid with Cover Photo & Caption */}
              <div className="p p-front">
                <b>
                  {event.coverPhotoUrl ? (
                    <Image
                      src={event.coverPhotoUrl}
                      alt={event.name}
                      fill
                      unoptimized
                      sizes="(max-width: 600px) 45vw, (max-width: 860px) 30vw, 240px"
                      style={{ objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <svg
                      width="34"
                      height="34"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3" y="4" width="18" height="16" rx="3" />
                      <circle cx="9" cy="10" r="1.8" />
                      <path d="m21 16-5-5-8 9" />
                    </svg>
                  )}
                </b>
                <em>{event.name}</em>
              </div>

              {/* Sticker circle with photo count on top */}
              <span className="dot">
                <b>{photoCount}</b>
                <small>photos</small>
              </span>
            </div>
          </Link>

          {/* Change Cover Camera Button (Sibling to Link on top-polaroid corner) */}
          <button
            type="button"
            className="cover-btn"
            aria-label={`Change cover photo for ${event.name}`}
            title={photoCount === 0 ? 'Add a photo first' : 'Change cover photo'}
            disabled={photoCount === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenCoverPicker(event);
            }}
          >
            <Camera className="w-5 h-5" />
          </button>
        </div>

        {/* Event info below the pile */}
        <Link href={`/events/${event.id}`} className="pile-info">
          <h3>{event.name}</h3>
          <p className="m">
            {formattedDate} · {memberCount} {memberCount === 1 ? 'person' : 'people'}
          </p>
          <span className="tag">{roleLabel}</span>
        </Link>
      </div>
    </li>
  );
}
