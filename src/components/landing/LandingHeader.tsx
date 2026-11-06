'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function LandingHeader() {
  const { data: session } = useSession();

  return (
    <header className="loveall-header">
      <Link href="/" className="loveall-logo" aria-label="loveall home">
        <i>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.7 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3.3 0 5.4 3.100 4.200 6.600-1.700 4.800-9.200 9.400-9.200 9.400z" />
          </svg>
        </i>
        <span>loveall</span>
      </Link>

      {session?.user ? (
        <Link href="/events" className="loveall-btn sm">
          My Events
        </Link>
      ) : (
        <Link href="/auth/signin" className="loveall-btn sm">
          Sign in
        </Link>
      )}
    </header>
  );
}
