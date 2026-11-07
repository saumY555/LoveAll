'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { DiscoveredPerson } from '@/components/photos/FaceDiscoveryBar';
import { MatchPanel } from './MatchPanel';

export const PERSON_COLORS = [
  'var(--pink)',
  'var(--mint)',
  'var(--lilac)',
  'var(--sun)',
  '#F7B08F',
  '#9FE3F2',
  '#F4C6A3',
  '#BFE8A6',
  '#F6A6A6',
  '#D9C2FF',
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
