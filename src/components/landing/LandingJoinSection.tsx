'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function LandingJoinSection() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = passcode.trim().toUpperCase();
    if (!cleanCode) {
      setError('Please enter a passcode.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/events/join-by-passcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode: cleanCode }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Invalid or expired passcode. Please verify with the event host.');
        setLoading(false);
        return;
      }

      // Success! Cookie is set by API; redirect to the event gallery
      router.push(`/events/${data.eventId}`);
    } catch (err: unknown) {
      console.error('Join error:', err);
      setError('Failed to join event. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <section id="join" className="loveall-section" aria-labelledby="jt">
      <div className="loveall-join">
        <div>
          <h2 id="jt">Got a passcode? Hop in.</h2>
          <p>Or start a new event and invite your people.</p>
        </div>
        <form onSubmit={handleJoin}>
          <label htmlFor="code">Event passcode</label>
          <input
            id="code"
            name="passcode"
            maxLength={6}
            placeholder="ABC123"
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="go"
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            disabled={loading}
          />
          <button className="loveall-btn alt" type="submit" disabled={loading}>
            {loading ? 'Joining...' : 'Join'}
          </button>
          <Link
            href="/events/new"
            className="loveall-btn"
            style={{ background: '#fff', flex: '1 1 100%' }}
          >
            Create a new event
          </Link>

          {error && (
            <div
              role="alert"
              style={{
                width: '100%',
                padding: '8px 14px',
                background: '#fff',
                borderRadius: '99px',
                border: '2px solid var(--line)',
                color: '#b91c1c',
                fontSize: '0.9rem',
                fontWeight: 700,
                marginTop: '4px',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
