'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export function LandingMobileDock() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let pastCta = false;
    let atJoin = false;

    const updateVisibility = () => {
      setShow(pastCta && !atJoin);
    };

    const ctaEl = document.querySelector('.loveall-cta') || document.querySelector('.cta');
    const joinEl = document.getElementById('join');

    let observerCta: IntersectionObserver | null = null;
    let observerJoin: IntersectionObserver | null = null;

    if (ctaEl) {
      observerCta = new IntersectionObserver(([entry]) => {
        pastCta = !entry.isIntersecting && entry.boundingClientRect.top < 0;
        updateVisibility();
      });
      observerCta.observe(ctaEl);
    }

    if (joinEl) {
      observerJoin = new IntersectionObserver(([entry]) => {
        atJoin = entry.isIntersecting;
        updateVisibility();
      });
      observerJoin.observe(joinEl);
    }

    return () => {
      observerCta?.disconnect();
      observerJoin?.disconnect();
    };
  }, []);

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
    <nav
      className={`loveall-dock ${show ? 'show' : ''}`}
      id="dock"
      aria-label="Quick actions"
    >
      <a className="loveall-btn alt" href="#join" onClick={scrollToJoin}>
        Enter passcode
      </a>
      <Link className="loveall-btn go" href="/events/new">
        Create event
      </Link>
    </nav>
  );
}
