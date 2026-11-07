'use client';

import React, { useId } from 'react';
import { DiscoveredPerson } from '@/components/photos/FaceDiscoveryBar';

interface MatchPanelProps {
  selectedPeople: Array<{
    id: string;
    index: number;
    name: string;
    color: string;
    photoCount: number;
  }>;
  mode: 'together' | 'either';
  onModeChange: (mode: 'together' | 'either') => void;
  onClear: () => void;
  matchingCount: number;
}

export function MatchPanel({
  selectedPeople,
  mode,
  onModeChange,
  onClear,
  matchingCount,
}: MatchPanelProps) {
  const clipBaseId = useId().replace(/:/g, '_');
  const count = selectedPeople.length;

  if (count === 0) {
    return (
      <div className="stage" aria-live="polite">
        <svg
          className="vn"
          viewBox="0 0 100 60"
          aria-hidden="true"
          style={{ maxWidth: '130px' }}
        >
          <circle
            cx="36"
            cy="30"
            r="24"
            fill="none"
            stroke="#3B2B26"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
          <circle
            cx="64"
            cy="30"
            r="24"
            fill="none"
            stroke="#3B2B26"
            strokeWidth="1.6"
            strokeDasharray="4 3"
          />
        </svg>
        <h3>Who are you looking for?</h3>
        <p className="say">Pick two or more friends, then choose Together or Either.</p>
      </div>
    );
  }

  const names = selectedPeople.map((p) => p.name);
  const formattedNames =
    names.length < 3
      ? names.join(' and ')
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  // Limit diagram to at most 3 people
  const diagramPeople = selectedPeople.slice(0, 3);
  const diagramCount = diagramPeople.length;

  const renderDiagram = () => {
    if (mode === 'either' && count > 1) {
      const k = diagramCount;
      const xs = k === 2 ? [24, 76] : [17, 50, 83];
      const rr = k === 2 ? 21 : 15;

      return (
        <svg
          className="vn"
          viewBox="0 0 100 62"
          role="img"
          aria-label={`Photos of any of ${count} people, ${matchingCount} in total`}
          style={{ fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}
        >
          {diagramPeople.map((p, i) => (
            <React.Fragment key={p.id}>
              <circle cx={xs[i]} cy="28" r={rr} fill="#fff" />
              <circle
                cx={xs[i]}
                cy="28"
                r={rr}
                fill={p.color}
                stroke="#3B2B26"
                strokeWidth="1.6"
              />
              <text
                x={xs[i]}
                y={k === 2 ? 28 : 29}
                textAnchor="middle"
                fontSize={k === 2 ? 11 : 9}
                fontWeight="800"
                fill="#2A1A14"
                style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif" }}
              >
                {p.photoCount}
              </text>
              <text
                x={xs[i]}
                y="35"
                textAnchor="middle"
                fontSize="4"
                fontWeight="800"
                fill="#2A1A14"
              >
                {p.name.length > 8 ? `${p.name.slice(0, 7)}…` : p.name}
              </text>
              {i < k - 1 && (
                <text
                  x={(xs[i] + xs[i + 1]) / 2}
                  y="31"
                  textAnchor="middle"
                  fontSize="6.5"
                  fontWeight="800"
                  fill="#3B2B26"
                >
                  or
                </text>
              )}
            </React.Fragment>
          ))}
          <text
            x="50"
            y="59"
            textAnchor="middle"
            fontSize="6"
            fontWeight="800"
            fill="#2A1A14"
          >
            {matchingCount} {matchingCount === 1 ? 'photo' : 'photos'} in total
          </text>
        </svg>
      );
    }

    // Together mode (or 1 person)
    const posMap: Record<number, Array<[number, number, number]>> = {
      1: [[50, 40, 30]],
      2: [[36, 40, 26], [64, 40, 26]],
      3: [[38, 30, 24], [62, 30, 24], [50, 52, 24]],
    };
    const labMap: Record<number, Array<[number, number]>> = {
      1: [[50, 22]],
      2: [[24, 40], [76, 40]],
      3: [[27, 20], [73, 20], [50, 70]],
    };

    const pos = posMap[diagramCount] || posMap[1];
    const lab = labMap[diagramCount] || labMap[1];

    const cx = 50;
    const cy = diagramCount === 3 ? 39 : 40;

    return (
      <svg
        className="vn"
        viewBox="0 0 100 80"
        role="img"
        aria-label={`Diagram of ${count} people, ${matchingCount} photos`}
        style={{ fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}
      >
        <defs>
          {pos.map((c, i) => (
            <clipPath key={i} id={`${clipBaseId}_clip_${i}`}>
              <circle cx={c[0]} cy={c[1]} r={c[2]} />
            </clipPath>
          ))}
        </defs>

        {/* Outer circles */}
        {pos.map((c, i) => (
          <React.Fragment key={`bg_${i}`}>
            <circle cx={c[0]} cy={c[1]} r={c[2]} fill="#fff" />
            <circle
              cx={c[0]}
              cy={c[1]}
              r={c[2]}
              fill={diagramPeople[i]?.color || '#FFA9CB'}
              fillOpacity={count > 1 ? 0.4 : 1}
            />
          </React.Fragment>
        ))}

        {/* Overlap area in Together mode */}
        {count > 1 && (
          diagramCount === 2 ? (
            <g clipPath={`url(#${clipBaseId}_clip_0)`}>
              <circle cx={pos[1][0]} cy={pos[1][1]} r={pos[1][2]} fill="#E8714F" />
            </g>
          ) : (
            <g clipPath={`url(#${clipBaseId}_clip_0)`}>
              <g clipPath={`url(#${clipBaseId}_clip_1)`}>
                <circle cx={pos[2][0]} cy={pos[2][1]} r={pos[2][2]} fill="#E8714F" />
              </g>
            </g>
          )
        )}

        {/* Stroke rings */}
        {pos.map((c, i) => (
          <circle
            key={`stroke_${i}`}
            cx={c[0]}
            cy={c[1]}
            r={c[2]}
            fill="none"
            stroke="#3B2B26"
            strokeWidth="1.6"
          />
        ))}

        {/* Person labels outside */}
        {count > 1 &&
          lab.map((l, i) => (
            <text
              key={`lbl_${i}`}
              x={l[0]}
              y={l[1] + 2}
              textAnchor="middle"
              fontSize="7"
              fontWeight="800"
              fill="#2A1A14"
              opacity="0.75"
            >
              {diagramPeople[i]?.index ?? (i + 1)}
            </text>
          ))}

        {/* Center count and text */}
        <text
          x={cx}
          y={cy + (diagramCount === 1 ? 2 : 1)}
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill="#2A1A14"
          style={{ fontFamily: "var(--font-bricolage), 'Bricolage Grotesque', sans-serif" }}
        >
          {matchingCount}
        </text>
        <text
          x={cx}
          y={cy + 7}
          textAnchor="middle"
          fontSize="4.6"
          fontWeight="800"
          fill="#2A1A14"
        >
          {matchingCount === 1 ? 'photo' : 'photos'}
        </text>
      </svg>
    );
  };

  return (
    <div className="stage" aria-live="polite">
      <div className="sh">
        <h3>Photos with {formattedNames}</h3>
        <button className="clear" type="button" onClick={onClear}>
          Clear
        </button>
      </div>

      {renderDiagram()}

      {count > 1 ? (
        <>
          <div className="seg" role="group" aria-label="Match mode">
            <button
              type="button"
              aria-pressed={mode === 'together'}
              onClick={() => onModeChange('together')}
            >
              <svg viewBox="0 0 56 36" width="56" aria-hidden="true">
                <defs>
                  <clipPath id={`${clipBaseId}_mini_clip`}>
                    <circle cx="20" cy="18" r="14" />
                  </clipPath>
                </defs>
                <circle cx="20" cy="18" r="14" fill="#fff" />
                <circle cx="36" cy="18" r="14" fill="#fff" />
                <circle
                  cx="36"
                  cy="18"
                  r="14"
                  fill="#E8714F"
                  clipPath={`url(#${clipBaseId}_mini_clip)`}
                />
                <circle cx="20" cy="18" r="14" fill="none" stroke="#3B2B26" strokeWidth="2" />
                <circle cx="36" cy="18" r="14" fill="none" stroke="#3B2B26" strokeWidth="2" />
              </svg>
              <span>Together</span>
              <small>All in one photo</small>
            </button>

            <button
              type="button"
              aria-pressed={mode === 'either'}
              onClick={() => onModeChange('either')}
            >
              <svg viewBox="0 0 56 36" width="56" aria-hidden="true">
                <circle cx="13" cy="18" r="11" fill="#FFC83D" stroke="#3B2B26" strokeWidth="2" />
                <circle cx="43" cy="18" r="11" fill="#FFC83D" stroke="#3B2B26" strokeWidth="2" />
                <text
                  x="28"
                  y="22"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="800"
                  fill="#3B2B26"
                  style={{ fontFamily: 'var(--font-nunito), Nunito, sans-serif' }}
                >
                  or
                </text>
              </svg>
              <span>Either</span>
              <small>Any one of them</small>
            </button>
          </div>

          <p className="say">
            {mode === 'together' ? (
              <>
                <b>Together:</b> {count > 2 ? 'all of them' : 'both'} in the same photo.
              </>
            ) : (
              <>
                <b>Either:</b> a photo with{' '}
                {names.length < 3
                  ? names.join(' or ')
                  : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`}.
              </>
            )}
          </p>
          {count > 3 && <p className="note">The diagram shows the first three.</p>}
        </>
      ) : (
        <p className="say">All of {names[0]}’s photos. Add a friend to combine.</p>
      )}
    </div>
  );
}
