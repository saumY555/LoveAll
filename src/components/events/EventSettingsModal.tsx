'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Check, Loader2 } from 'lucide-react';

export interface EventSettingsData {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  eventDate: string | Date | null;
  isPrivate: boolean;
  allowGuestView: boolean;
  allowGuestUpload: boolean;
}

interface EventSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventSettingsData;
  onEventUpdated: (updated: Partial<Omit<EventSettingsData, 'eventDate'>> & { eventDate?: string | Date | null }) => void;
}

export function EventSettingsModal({
  isOpen,
  onClose,
  event,
  onEventUpdated,
}: EventSettingsModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [name, setName] = useState(event.name || '');
  const [description, setDescription] = useState(event.description || '');
  const [eventDate, setEventDate] = useState(
    event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : ''
  );
  const [isPrivate, setIsPrivate] = useState(event.isPrivate ?? true);
  const [allowGuestView, setAllowGuestView] = useState(event.allowGuestView ?? false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(event.allowGuestUpload ?? false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Open / Close native dialog & trap focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      setName(event.name || '');
      setDescription(event.description || '');
      setEventDate(event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : '');
      setIsPrivate(event.isPrivate ?? true);
      setAllowGuestView(event.allowGuestView ?? false);
      setAllowGuestUpload(event.allowGuestUpload ?? false);
      setError(null);
      setSuccessMessage(null);
      setShowDeleteConfirm(false);
      document.body.style.overflow = 'hidden';
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
  }, [isOpen, event]);

  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width;

    if (!isInDialog) {
      onClose();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          eventDate: eventDate || undefined,
          isPrivate,
          allowGuestView,
          allowGuestUpload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');

      onEventUpdated({
        name: name.trim(),
        description: description.trim() || null,
        eventDate: eventDate || null,
        isPrivate,
        allowGuestView,
        allowGuestUpload,
      });

      setSuccessMessage('Event settings updated!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete event');

      onClose();
      router.push('/events');
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to delete event');
      setIsDeleting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="loveall-modal"
      onCancel={handleCancel}
      onClick={handleDialogClick}
      aria-labelledby="settings-title"
      style={{ maxWidth: '580px' }}
    >
      <div className="dh">
        <div>
          <h2 id="settings-title">Event settings</h2>
          <p>Modify event details, visitor permissions, or delete this event.</p>
        </div>
        <button
          className="x"
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="db" style={{ gap: '20px' }}>
        {error && (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              borderRadius: '16px',
              background: '#fee2e2',
              border: '2px solid #ef4444',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              padding: '12px 16px',
              borderRadius: '16px',
              background: '#dcfce7',
              border: '2px solid #22c55e',
              color: '#15803d',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Check className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          {/* Event Name */}
          <div className="field">
            <label htmlFor="settings-name" style={{ fontWeight: 800, fontSize: '0.95rem', display: 'block', marginBottom: '6px' }}>
              Event name <span style={{ color: 'var(--tomato)' }}>*</span>
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 16px',
                border: '2px solid var(--line)',
                borderRadius: '16px',
                background: '#fff',
                color: 'var(--ink)',
                font: '700 1rem var(--font-nunito), Nunito, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Event Date */}
          <div className="field">
            <label htmlFor="settings-date" style={{ fontWeight: 800, fontSize: '0.95rem', display: 'block', marginBottom: '6px' }}>
              Event date
            </label>
            <input
              id="settings-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              style={{
                width: '100%',
                minHeight: '48px',
                padding: '0 16px',
                border: '2px solid var(--line)',
                borderRadius: '16px',
                background: '#fff',
                color: 'var(--ink)',
                font: '700 1rem var(--font-nunito), Nunito, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Description */}
          <div className="field">
            <label htmlFor="settings-desc" style={{ fontWeight: 800, fontSize: '0.95rem', display: 'block', marginBottom: '6px' }}>
              Description
            </label>
            <textarea
              id="settings-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What was this event about?"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid var(--line)',
                borderRadius: '16px',
                background: '#fff',
                color: 'var(--ink)',
                font: '600 0.95rem var(--font-nunito), Nunito, sans-serif',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Access & Sharing Permissions Card */}
          <div
            style={{
              padding: '16px 18px',
              background: 'var(--surface)',
              border: '2px solid var(--line)',
              borderRadius: '24px 24px 24px 10px',
              boxShadow: '4px 4px 0 var(--line)',
              display: 'grid',
              gap: '12px',
            }}
          >
            <h4
              style={{
                fontFamily: 'var(--font-bricolage), Bricolage Grotesque, sans-serif',
                fontWeight: 800,
                fontSize: '1rem',
                margin: 0,
                color: 'var(--ink)',
              }}
            >
              Access & Sharing Permissions
            </h4>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--tomato)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)' }}>Private Event</span>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Only members or visitors with an authorized passcode can view.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowGuestView}
                onChange={(e) => setAllowGuestView(e.target.checked)}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--tomato)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)' }}>Allow Guest Viewing</span>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Visitors with a share link can view photos without an account.
                </p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={allowGuestUpload}
                onChange={(e) => setAllowGuestUpload(e.target.checked)}
                style={{ width: '20px', height: '20px', marginTop: '2px', accentColor: 'var(--tomato)', cursor: 'pointer' }}
              />
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)' }}>Allow Guest Uploads</span>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Visitors with a share link can upload photos to this album.
                </p>
              </div>
            </label>
          </div>

          {/* Form Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              className="btn sm"
              onClick={onClose}
              disabled={isSaving}
              style={{ background: '#fff' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn go"
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>

        {/* Danger Zone: Delete Event */}
        <div
          style={{
            marginTop: '8px',
            padding: '16px 18px',
            background: '#FFF1EE',
            border: '2px solid var(--line)',
            borderRadius: '24px 24px 24px 10px',
            boxShadow: '4px 4px 0 var(--line)',
            display: 'grid',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: 'var(--tomato)', flexShrink: 0 }} />
            <h4
              style={{
                fontFamily: 'var(--font-bricolage), Bricolage Grotesque, sans-serif',
                fontWeight: 800,
                fontSize: '1.05rem',
                margin: 0,
                color: 'var(--tomato)',
              }}
            >
              Danger Zone
            </h4>
          </div>

          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)', fontWeight: 600, lineHeight: 1.4 }}>
            Deleting this event moves it and all photos into the trash with a{' '}
            <strong>7-day recovery period</strong>.
          </p>

          {!showDeleteConfirm ? (
            <div>
              <button
                type="button"
                className="btn sm"
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  background: 'var(--tomato)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: 'var(--line)',
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete this event
              </button>
            </div>
          ) : (
            <div
              style={{
                background: '#fff',
                border: '2px solid var(--line)',
                borderRadius: '16px',
                padding: '12px 14px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <p style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--ink)' }}>
                Are you sure? This action will remove the event immediately.
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  style={{ background: '#fff' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    background: 'var(--tomato)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeleting ? 'Deleting...' : 'Yes, delete event'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
