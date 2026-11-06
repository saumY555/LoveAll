'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface Person {
  id: string;
  name: string;
  img: string;
}

interface Pic {
  t: string[];
  cap: string;
  alt: string;
  src: string;
  ar: number;
  x: number;
  y: number;
  r: number;
}

const PEOPLE: Person[] = [
  { id: 'm', name: 'Mira', img: '/landing/avatar-mira.jpg' },
  { id: 'd', name: 'Dev', img: '/landing/avatar-dev.jpg' },
  { id: 'a', name: 'Anya', img: '/landing/avatar-anya.jpg' },
];

const PICS: Pic[] = [
  {
    t: ['m', 'd'],
    cap: 'Flowers and spins',
    alt: 'A couple laughing as they spin, holding a bunch of wildflowers',
    src: '/landing/pol-flowers.jpg',
    ar: 1,
    x: 1,
    y: 2,
    r: -5,
  },
  {
    t: ['m', 'a'],
    cap: 'Movie night',
    alt: 'Four illustrated film characters sitting together on a sofa',
    src: '/landing/pol-movie.jpg',
    ar: 1.5,
    x: 53,
    y: 0,
    r: 4,
  },
  {
    t: ['a', 'd'],
    cap: 'Sparkler time',
    alt: 'A family lighting sparklers on the steps of a decorated home',
    src: '/landing/pol-sparkler.jpg',
    ar: 1.05,
    x: 6,
    y: 52,
    r: 3,
  },
  {
    t: ['m'],
    cap: 'Festival day',
    alt: 'An illustration of a woman and a man smiling, with a lit candle between them',
    src: '/landing/pol-festival.jpg',
    ar: 1.1,
    x: 51,
    y: 50,
    r: -4,
  },
];

export function PhotoDemo() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'all' | 'any'>('all');

  const togglePerson = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedArray = Array.from(selected);
  let hitCount = 0;

  const renderedPics = PICS.map((p) => {
    const isHit =
      selectedArray.length === 0 ||
      (mode === 'all'
        ? selectedArray.every((id) => p.t.includes(id))
        : selectedArray.some((id) => p.t.includes(id)));

    if (isHit) hitCount++;

    const isOff = !isHit;
    const isOn = isHit && selectedArray.length > 0;

    return {
      pic: p,
      isOff,
      isOn,
    };
  });

  const names = selectedArray
    .map((id) => PEOPLE.find((person) => person.id === id)?.name)
    .filter(Boolean)
    .join(selectedArray.length > 1 ? (mode === 'all' ? ' + ' : ' or ') : '');

  const countText =
    selectedArray.length === 0
      ? 'Tap a friend to find their photos.'
      : hitCount > 0
      ? `${hitCount} photo${hitCount > 1 ? 's' : ''} with ${names}`
      : `No photos with ${names} yet.`;

  return (
    <div className="loveall-demo" aria-label="Try it: tap a friend to find their photos">
      <div className="loveall-stage" id="stage">
        {renderedPics.map(({ pic, isOff, isOn }) => (
          <figure
            key={pic.cap}
            className={`loveall-pol ${isOff ? 'off' : ''} ${isOn ? 'on' : ''}`}
            style={
              {
                left: `${pic.x}%`,
                top: `${pic.y}%`,
                '--r': `${pic.r}deg`,
                margin: 0,
              } as React.CSSProperties
            }
          >
            <div className="pic" style={{ aspectRatio: pic.ar }}>
              <Image
                src={pic.src}
                alt={pic.alt}
                width={400}
                height={Math.round(400 / pic.ar)}
                sizes="(max-width: 860px) 44vw, 240px"
                loading="lazy"
                priority={false}
              />
            </div>
            <figcaption>{pic.cap}</figcaption>
          </figure>
        ))}
      </div>

      <div className="loveall-controls" id="controls">
        {PEOPLE.map((person) => {
          const isPressed = selected.has(person.id);
          return (
            <button
              key={person.id}
              type="button"
              className="loveall-chip"
              aria-pressed={isPressed}
              onClick={() => togglePerson(person.id)}
            >
              <span className="avatar">
                <Image
                  src={person.img}
                  alt={person.name}
                  width={34}
                  height={34}
                  unoptimized
                />
              </span>
              <span>{person.name}</span>
            </button>
          );
        })}

        <div className="loveall-mode" role="group" aria-label="Match mode">
          <button
            type="button"
            data-mode="all"
            aria-pressed={mode === 'all'}
            onClick={() => setMode('all')}
          >
            Together
          </button>
          <button
            type="button"
            data-mode="any"
            aria-pressed={mode === 'any'}
            onClick={() => setMode('any')}
          >
            Either
          </button>
        </div>

        <div className="loveall-count" id="count" aria-live="polite">
          {countText}
        </div>
      </div>
    </div>
  );
}
