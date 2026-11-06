'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';
import { EventWithRole } from '@/types';
import { PolaroidPile } from '@/components/events/PolaroidPile';
import { CoverPhotoPickerModal } from '@/components/events/CoverPhotoPickerModal';
import { PasscodeModal } from '@/components/events/PasscodeModal';
import { CreateEventModal } from '@/components/events/CreateEventModal';

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [filter, setFilter] = useState<'all' | 'host' | 'member'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Sheets
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [selectedEventForCover, setSelectedEventForCover] = useState<EventWithRole | null>(null);

  // Passcode inline empty state form
  const [inlinePasscode, setInlinePasscode] = useState('');
  const [inlineJoining, setInlineJoining] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const loadEvents = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events || []);
      } else {
        setError(data.error || "Couldn't load your events. Try again.");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Couldn't load your events. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    if (status === 'authenticated') {
      loadEvents();
    }
  }, [status, router]);

  // Counts for filter chips
  const countAll = events.length;
  const countHost = events.filter((e) => e.userRole === 'OWNER').length;
  const countMember = events.filter((e) => e.userRole === 'MEMBER').length;

  const filteredEvents = events.filter((e) => {
    if (filter === 'host') return e.userRole === 'OWNER';
    if (filter === 'member') return e.userRole === 'MEMBER';
    return true;
  });

  // Handle Cover Photo Change (Optimistic Update)
  const handleSaveCover = async (photoId: string, previewUrl: string) => {
    if (!selectedEventForCover) return;
    const targetEventId = selectedEventForCover.id;
    const oldCoverUrl = selectedEventForCover.coverPhotoUrl;
    const oldCoverId = selectedEventForCover.coverPhotoId;

    // 1. Optimistic Update on UI
    setEvents((prev) =>
      prev.map((e) =>
        e.id === targetEventId
          ? { ...e, coverPhotoUrl: previewUrl, coverPhotoId: photoId }
          : e
      )
    );
    showToast('Cover updated');

    // 2. Persist to API
    try {
      const res = await fetch(`/api/events/${targetEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverPhotoId: photoId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Server rejected update');
      }
    } catch (err) {
      console.error('Failed to change cover photo:', err);
      // Revert optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === targetEventId
            ? { ...e, coverPhotoUrl: oldCoverUrl, coverPhotoId: oldCoverId }
            : e
        )
      );
      showToast("Couldn't change the cover. Try again.");
    }
  };

  // Inline Passcode Submit for Joined Empty State
  const handleInlinePasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inlinePasscode.trim().toUpperCase();
    if (!cleanCode) return;

    setInlineJoining(true);
    setInlineError(null);

    try {
      const res = await fetch('/api/events/join-by-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: cleanCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired passcode');
      }
      setInlinePasscode('');
      router.push(`/events/${data.eventId}`);
    } catch (err: unknown) {
      setInlineError((err as Error).message || 'Failed to join');
      setInlineJoining(false);
    }
  };

  const userInitial = (
    session?.user?.name?.[0] ||
    session?.user?.email?.[0] ||
    'U'
  ).toUpperCase();
  const userName = session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  return (
    <div className="loveall-events">
      <div className="wrap">
        {/* Header */}
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
            <button
              type="button"
              className="btn sm"
              style={{ background: 'var(--surface)' }}
              onClick={() => setIsPasscodeModalOpen(true)}
            >
              Join with passcode
            </button>
            <button
              type="button"
              className="btn go"
              onClick={() => setIsCreateModalOpen(true)}
            >
              New event
            </button>

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

        <main>
          {/* Page Intro */}
          <div className="intro">
            <h1>Your events</h1>
            <p>Shared photo spaces for trips, parties, weddings and hangouts.</p>
          </div>

          {/* Filter Bar */}
          <div className="bar" id="tabs" role="group" aria-label="Filter events">
            <button
              className="chip"
              type="button"
              data-f="all"
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All <span>{countAll}</span>
            </button>
            <button
              className="chip"
              type="button"
              data-f="host"
              aria-pressed={filter === 'host'}
              onClick={() => setFilter('host')}
            >
              Hosted by me <span>{countHost}</span>
            </button>
            <button
              className="chip"
              type="button"
              data-f="member"
              aria-pressed={filter === 'member'}
              onClick={() => setFilter('member')}
            >
              Joined <span>{countMember}</span>
            </button>

            <div className="count" id="count" aria-live="polite">
              {!isLoading && !error && (
                filteredEvents.length > 0
                  ? `${filteredEvents.length} event${filteredEvents.length === 1 ? '' : 's'}`
                  : ''
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              style={{
                maxWidth: '480px',
                margin: '20px auto 40px',
                padding: '24px',
                background: '#fff',
                border: '2px solid var(--line)',
                borderRadius: '24px',
                boxShadow: '4px 4px 0 var(--line)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#b91c1c', marginBottom: '12px' }}>
                ⚠️ {error}
              </p>
              <button
                type="button"
                className="btn alt"
                onClick={loadEvents}
                style={{ padding: '0 20px' }}
              >
                <RefreshCw className="w-4 h-4 mr-1 inline" /> Try again
              </button>
            </div>
          )}

          {/* Skeleton Loading State */}
          {isLoading && !error && (
            <ul className="wall">
              {[1, 2, 3, 4].map((i) => (
                <li key={i} className="li">
                  <div className="pile-wrap" style={{ opacity: 0.6 }}>
                    <div className="pics">
                      <div className="p"></div>
                      <div className="p"></div>
                      <div className="p">
                        <b>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Loading...</span>
                        </b>
                        <em>...</em>
                      </div>
                    </div>
                    <div style={{ height: '20px', width: '70%', background: '#ebdcd0', borderRadius: '4px', margin: '8px 0 4px' }} />
                    <div style={{ height: '14px', width: '45%', background: '#ebdcd0', borderRadius: '4px' }} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Wall of Events */}
          {!isLoading && !error && (
            <>
              {filteredEvents.length > 0 ? (
                <ul className="wall" id="wall">
                  {filteredEvents.map((event, index) => (
                    <PolaroidPile
                      key={event.id}
                      event={event}
                      index={index}
                      onOpenCoverPicker={(ev) => setSelectedEventForCover(ev)}
                    />
                  ))}

                  {/* Last Tile: New Event Tile */}
                  <li className="li">
                    <button
                      type="button"
                      className="new"
                      onClick={() => setIsCreateModalOpen(true)}
                      aria-label="Create a new event"
                    >
                      <i aria-hidden="true">+</i>
                      <span>New event</span>
                    </button>
                  </li>
                </ul>
              ) : filter === 'member' ? (
                /* Empty state for Joined filter: lilac card */
                <div className="empty" id="empty" style={{ display: 'block' }}>
                  <h3>No joined events yet</h3>
                  <p>Got a passcode from a friend? Enter it to see their photos.</p>
                  <form onSubmit={handleInlinePasscodeSubmit}>
                    <label htmlFor="inline-code" style={{ width: '100%', fontWeight: 800 }}>
                      Event passcode
                    </label>
                    <input
                      id="inline-code"
                      maxLength={6}
                      placeholder="ABC123"
                      autoComplete="off"
                      autoCapitalize="characters"
                      enterKeyHint="go"
                      value={inlinePasscode}
                      onChange={(e) => setInlinePasscode(e.target.value.toUpperCase())}
                      disabled={inlineJoining}
                      required
                    />
                    <button className="btn alt" type="submit" disabled={inlineJoining}>
                      {inlineJoining ? 'Joining...' : 'Join'}
                    </button>

                    {inlineError && (
                      <p style={{ width: '100%', color: '#991b1b', fontWeight: 800, fontSize: '0.85rem', marginTop: '6px' }}>
                        ⚠️ {inlineError}
                      </p>
                    )}
                  </form>
                </div>
              ) : (
                /* Empty state for All or Hosted */
                <div className="empty" style={{ display: 'block', background: 'var(--mint)' }}>
                  <h3>No events found</h3>
                  <p>Create your first shared album and start collecting memories together!</p>
                  <button
                    type="button"
                    className="btn go"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    Create first event
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer>
          <span>Made with 💖 for celebrating memories together.</span>
          <ul>
            <li>🔒 Private and safe</li>
            <li>🙋 Asks before it tags</li>
            <li>⚡ Lightning fast</li>
          </ul>
        </footer>
      </div>

      {/* Mobile Bottom Dock (Phones Only) */}
      <nav className="dock" aria-label="Quick actions">
        <button
          type="button"
          className="btn alt"
          onClick={() => setIsPasscodeModalOpen(true)}
        >
          Enter passcode
        </button>
        <button
          type="button"
          className="btn go"
          onClick={() => setIsCreateModalOpen(true)}
        >
          New event
        </button>
      </nav>

      {/* Cover Photo Picker Sheet / Modal */}
      {selectedEventForCover && (
        <CoverPhotoPickerModal
          isOpen={Boolean(selectedEventForCover)}
          onClose={() => setSelectedEventForCover(null)}
          event={selectedEventForCover}
          currentCoverPhotoId={selectedEventForCover.coverPhotoId || null}
          onSaveCover={handleSaveCover}
        />
      )}

      {/* Passcode Modal */}
      <PasscodeModal
        isOpen={isPasscodeModalOpen}
        onClose={() => setIsPasscodeModalOpen(false)}
        onSuccess={() => loadEvents()}
      />

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={(newEvent) => {
          setIsCreateModalOpen(false);
          router.push(`/events/${newEvent.id}`);
        }}
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 120,
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '2px solid var(--line)',
            borderRadius: '99px',
            boxShadow: '4px 4px 0 var(--line)',
            padding: '10px 22px',
            fontFamily: 'var(--font-nunito), sans-serif',
            fontWeight: 800,
            fontSize: '0.95rem',
            animation: 'fadeIn .2s ease-in',
          }}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
