'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { LogOut } from 'lucide-react';

interface GalleryHeaderProps {
  onNewEvent?: () => void;
}

export function GalleryHeader({ onNewEvent }: GalleryHeaderProps) {
  const { data: session } = useSession();

  const userInitial = (
    session?.user?.name?.[0] ||
    session?.user?.email?.[0] ||
    'U'
  ).toUpperCase();
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  return (
    <header>
      <Link href="/" className="logo" aria-label="loveall home">
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
            <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.7 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3.3 0 5.4 3.1 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
          </svg>
        </i>
        <span>loveall</span>
      </Link>

      <nav className="top" aria-label="Main">
        <Link href="/events" className="btn sm">
          Events
        </Link>
        {onNewEvent ? (
          <button type="button" className="btn go" onClick={onNewEvent}>
            New event
          </button>
        ) : (
          <Link href="/events" className="btn go">
            New event
          </Link>
        )}

        <div className="who">
          <span className="av" aria-hidden="true">
            {session?.user?.image ? (
              <img src={session.user.image} alt="" />
            ) : (
              userInitial
            )}
          </span>
          <span className="name">{userName}</span>
        </div>

        <button
          className="icon-btn"
          type="button"
          aria-label="Sign out"
          title="Sign out"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="w-5 h-5" />
        </button>
      </nav>
    </header>
  );
}
