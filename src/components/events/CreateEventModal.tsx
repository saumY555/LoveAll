'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { EventWithRole } from '@/types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: (newEvent: EventWithRole) => void;
}

export function CreateEventModal({ isOpen, onClose, onEventCreated }: CreateEventModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Form inputs
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [allowGuestView, setAllowGuestView] = useState(false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(false);

  // Validation & UI State
  const [isNameBad, setIsNameBad] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Open / Close native dialog & trap focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
      setIsNameBad(false);
      setToastMessage(null);

      // Focus on Event name field when opened
      const timer = setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);

      return () => clearTimeout(timer);
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle native cancel (Esc key)
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  // Close on backdrop click
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Option A sync: Ticking guest uploads auto-checks guest viewing; unticking viewing auto-unticks uploads
  const handleGuestUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAllowGuestUpload(checked);
    if (checked) {
      setAllowGuestView(true);
    }
  };

  const handleGuestViewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAllowGuestView(checked);
    if (!checked) {
      setAllowGuestUpload(false);
    }
  };

  // Summary line text based on guest viewing and upload flags
  const getSummaryText = () => {
    if (!allowGuestView && !allowGuestUpload) {
      return 'Guests can’t see or add photos. Only members can.';
    }
    if (allowGuestView && !allowGuestUpload) {
      return 'Guests can browse photos but can’t add any.';
    }
    if (allowGuestView && allowGuestUpload) {
      return 'Guests can browse and add photos.';
    }
    return 'Guests can add photos but can’t browse the gallery.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setIsNameBad(true);
      nameInputRef.current?.focus();
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || undefined,
          eventDate: eventDate || undefined,
          coverImage: coverImage.trim() || undefined,
          isPrivate,
          allowGuestView,
          allowGuestUpload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      onClose();

      // Reset form
      setName('');
      setEventDate('');
      setCoverImage('');
      setDescription('');
      setIsPrivate(true);
      setAllowGuestView(false);
      setAllowGuestUpload(false);
      setIsNameBad(false);

      if (onEventCreated) {
        onEventCreated(data.event);
      } else {
        router.push(`/events/${data.event.id}`);
      }
    } catch (err: unknown) {
      console.error('Failed to create event:', err);
      showToast('Couldn’t create the event. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        id="ne"
        className="loveall-modal"
        aria-labelledby="nt"
        onCancel={handleCancel}
        onClick={handleDialogClick}
      >
        <div className="dh">
          <div>
            <h2 id="nt">New event</h2>
            <p>Set up a shared gallery for your friends, trip or gathering.</p>
          </div>
          <button
            className="x"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form className="ce" id="f" noValidate onSubmit={handleSubmit}>
          <div className="db">
            {/* Event Name */}
            <label className={`field${isNameBad ? ' bad' : ''}`} id="fn">
              Event name <span className="opt-t">(required)</span>
              <input
                ref={nameInputRef}
                id="name"
                maxLength={80}
                placeholder="Summer road trip 2026"
                autoComplete="off"
                aria-describedby="nerr"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (isNameBad) setIsNameBad(false);
                }}
              />
              <span className="err" id="nerr">
                Give your event a name.
              </span>
            </label>

            {/* Event Date & Cover Image */}
            <div className="two">
              <label className="field">
                Event date <span className="opt-t">(optional)</span>
                <input
                  id="date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </label>

              <label className="field">
                Cover image link <span className="opt-t">(optional)</span>
                <input
                  id="cover"
                  type="url"
                  inputMode="url"
                  placeholder="https://example.com/cover.jpg"
                  autoComplete="off"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
                <span className="hint">
                  You can pick a cover from the event’s photos later.
                </span>
              </label>
            </div>

            {/* Description */}
            <label className="field">
              Description <span className="opt-t">(optional)</span>
              <textarea
                id="desc"
                placeholder="What memories will we make here?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            {/* Who can get in card */}
            <fieldset className="card acc" style={{ border: '2px solid var(--line)', margin: 0 }}>
              <legend style={{ position: 'absolute', left: '-9999px' }}>
                Who can get in
              </legend>
              <h3>Who can get in</h3>
              <div className="opts" style={{ gridTemplateColumns: '1fr' }}>
                <label className="opt">
                  <input
                    type="checkbox"
                    id="priv"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span>
                    <b>Private event</b>
                    <small>Only invited members, or guests with a valid passcode or link, can see it</small>
                  </span>
                </label>

                <label className="opt">
                  <input
                    type="checkbox"
                    id="gv"
                    checked={allowGuestView}
                    onChange={handleGuestViewChange}
                  />
                  <span>
                    <b>Allow guest viewing</b>
                    <small>Anyone with your link or passcode can browse photos, no account needed</small>
                  </span>
                </label>

                <label className="opt">
                  <input
                    type="checkbox"
                    id="gu"
                    checked={allowGuestUpload}
                    onChange={handleGuestUploadChange}
                  />
                  <span>
                    <b>Allow guest uploads</b>
                    <small>Guests with your link can add photos to the gallery</small>
                  </span>
                </label>
              </div>

              <p className="sum" id="sum" aria-live="polite">
                {getSummaryText()}
              </p>
            </fieldset>
          </div>

          {/* Dialog Footer */}
          <div className="df">
            <button
              className="btn white"
              type="button"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              className="btn go"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Creating…' : 'Create event'}
            </button>
          </div>
        </form>
      </dialog>

      {/* Failure Toast notification inside or above dialog */}
      {toastMessage && (
        <div
          className="toast on"
          role="status"
          aria-live="polite"
        >
          {toastMessage}
        </div>
      )}
    </>
  );
}
