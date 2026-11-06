'use client';

import React from 'react';
import Link from 'next/link';
import { PhotoDemo } from './PhotoDemo';

export function LandingHero() {
  const scrollToJoin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const joinEl = document.getElementById('join');
    if (joinEl) {
      joinEl.scrollIntoView({ behavior: 'smooth' });
      const inputEl = document.getElementById('code') as HTMLInputElement | null;
      if (inputEl) {
        setTimeout(() => inputEl.focus(), 400);
      }
    }
  };

  return (
    <div className="loveall-hero">
      <div>
        <h1>
          <span>Every moment, shared.</span>
          <span>Zero hassle finding yours.</span>
        </h1>
        <p className="lede">
          Collect thousands of photos from friends at your college fest, wedding, or weekend roadtrip.
          Browse instantly and see who’s in which photo.
        </p>
        <div className="loveall-cta cta">
          <Link href="/events" className="loveall-btn go">
            Start exploring
          </Link>
          <a href="#join" onClick={scrollToJoin} className="loveall-btn alt">
            Join with passcode
          </a>
        </div>
        <ul className="loveall-perks">
          <li>📷 Original quality</li>
          <li>👯 Find by 2+ friends</li>
          <li>⚡ One-click ZIP download</li>
        </ul>
      </div>

      <PhotoDemo />
    </div>
  );
}
