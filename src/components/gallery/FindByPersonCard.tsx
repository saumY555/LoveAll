'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { DiscoveredPerson } from '@/components/photos/FaceDiscoveryBar';
import { MatchPanel } from './MatchPanel';

export const PERSON_COLORS = [
  '#FFA9CB', // pink
  '#6FD9B0', // mint
  '#C5B4FF', // lilac
  '#FFC83D', // sun
  '#F7B08F',
  '#9FE3F2',
];

interface FindByPersonCardProps {
  people: DiscoveredPerson[];
  selectedPersonIds: string[];
  filterMode: 'together' | 'either';
  onTogglePerson: (personId: string) => void;
  onClearSelection: () => void;
  onModeChange: (mode: 'together' | 'either') => void;
  matchingCount: number;
  totalPhotosCount: number;
  isScanning: boolean;
  serviceWarning?: string | null;
  onGroupFaces: () => void;
  onOpenPrivacy: () => void;
  onRenamePerson?: (person: DiscoveredPerson) => void;
}

export function FindByPersonCard({
  people,
  selectedPersonIds,
  filterMode,
  onTogglePerson,
  onClearSelection,
  onModeChange,
  matchingCount,
  totalPhotosCount,
  isScanning,
  serviceWarning,
  onGroupFaces,
  onOpenPrivacy,
  onRenamePerson,
}: FindByPersonCardProps) {
  const [showAll, setShowAll] = useState(false);

  // Map each person to index & consistent color
  const enrichedPeople = people.map((p, idx) => ({
    ...p,
    index: idx + 1,
    displayName: p.name && p.name !== 'Unnamed Person' ? p.name : `Person ${idx + 1}`,
    color: PERSON_COLORS[idx % PERSON_COLORS.length],
  }));

  const visiblePeople = showAll ? enrichedPeople : enrichedPeople.slice(0, 7);

  const selectedEnriched = enrichedPeople.filter((p) =>
    selectedPersonIds.includes(p.id)
  );

  return (
    <section className="people" aria-labelledby="fp">
      <div className="ph">
        <h2 id="fp">Find by person</h2>
        <span className="tag" id="pn">
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
        {serviceWarning ? (
          <span
            className="tag"
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '2px solid #ef4444',
              fontWeight: 700,
            }}
          >
            <span>⚠️ {serviceWarning}</span>
          </span>
        ) : isScanning ? (
          <span
            className="tag"
            style={{
              background: 'var(--tomato)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              border: '2px solid var(--ink)',
            }}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Grouping faces in background…</span>
          </span>
        ) : null}
      </div>
      <p className="hint">Tap a friend. Tap two to see photos of them together.</p>

      <div className="pbody">
        {/* Faces grid */}
        <div className="faces" id="faces" role="group" aria-label="People">
          {/* All photos bubble */}
          <button
            className="fb all"
            type="button"
            data-id="0"
            aria-pressed={selectedPersonIds.length === 0}
            onClick={onClearSelection}
          >
            <span className="fc">
              <span>All</span>
              <em>{totalPhotosCount}</em>
            </span>
            <span>All photos</span>
          </button>

          {/* People bubbles */}
          {visiblePeople.map((person) => {
            const isSelected = selectedPersonIds.includes(person.id);
            return (
              <button
                key={person.id}
                className="fb"
                type="button"
                data-id={person.id}
                aria-pressed={isSelected}
                style={{ ['--c' as any]: person.color }}
                onClick={() => onTogglePerson(person.id)}
                onContextMenu={(e) => {
                  if (onRenamePerson) {
                    e.preventDefault();
                    onRenamePerson(person);
                  }
                }}
              >
                <span className="fc">
                  {person.thumbnailUrl ? (
                    <img
                      src={person.thumbnailUrl}
                      alt={person.displayName}
                      className="fc-img"
                      loading="lazy"
                    />
                  ) : (
                    <span>{person.index}</span>
                  )}
                  <em>{person.photoCount}</em>
                </span>
                <span>{person.displayName}</span>
              </button>
            );
          })}

          {/* More toggle bubble if > 7 people */}
          {enrichedPeople.length > 7 && (
            <button
              className="fb more"
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
            >
              <span className="fc">
                {showAll ? '−' : `+${enrichedPeople.length - 7}`}
              </span>
              <span>{showAll ? 'Show less' : 'Show all'}</span>
            </button>
          )}
        </div>

        {/* Match panel stage */}
        <MatchPanel
          selectedPeople={selectedEnriched.map((p) => ({
            id: p.id,
            index: p.index,
            name: p.displayName,
            color: p.color,
            photoCount: p.photoCount,
          }))}
          mode={filterMode}
          onModeChange={onModeChange}
          onClear={onClearSelection}
          matchingCount={matchingCount}
          onManagePerson={(personId) => {
            const p = people.find((item) => item.id === personId);
            if (p && onRenamePerson) onRenamePerson(p);
          }}
        />
      </div>

      {/* Bottom tools in lilac card */}
      <div className="ptools">
        <button
          className="btn"
          type="button"
          onClick={onGroupFaces}
          disabled={isScanning}
        >
          {isScanning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Grouping faces…</span>
            </>
          ) : (
            'Group faces'
          )}
        </button>
        <button className="btn" type="button" onClick={onOpenPrivacy}>
          Privacy
        </button>
      </div>
    </section>
  );
}
