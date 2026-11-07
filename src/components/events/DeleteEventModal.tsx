'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Trash2, AlertTriangle, LogOut, Loader2 } from 'lucide-react';
import { EventWithRole } from '@/types';

interface DeleteEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithRole | null;
  onDeleted: (eventId: string, message: string) => void;
}

export function DeleteEventModal({
  isOpen,
  onClose,
  event,
  onDeleted,
}: DeleteEventModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = event?.userRole === 'OWNER';
  const actionTitle = isOwner ? 'Delete event' : 'Leave event';

  // Open / Close native dialog & trap focus
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      setError(null);
      setIsLoading(false);
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
  }, [isOpen]);

  // Handle native cancel (Esc key)
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onClose();
  };

  // Close on backdrop click
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

  const handleConfirmAction = async () => {
    if (!event) return;
    setIsLoading(true);
    setError(null);

    try {
      if (isOwner) {
        // Soft delete event (Owner)
        const res = await fetch(`/api/events/${event.id}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to delete event');
        }
        onDeleted(event.id, `"${event.name}" was deleted.`);
      } else {
        // Leave event (Member)
        const res = await fetch(`/api/events/${event.id}/leave`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to leave event');
        }
        onDeleted(event.id, `You left "${event.name}".`);
      }
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!event) return null;

  return (
    <dialog
      ref={dialogRef}
      className="loveall-modal"
      onCancel={handleCancel}
      onClick={handleDialogClick}
      aria-labelledby="del-modal-title"
      style={{ maxWidth: '480px' }}
    >
      <div className="dh">
        <div>
          <h2 id="del-modal-title">
            {isOwner ? 'Delete event?' : 'Leave event?'}
          </h2>
          <p>
            {isOwner
              ? 'Are you sure you want to delete this event?'
              : 'Are you sure you want to leave this event?'}
          </p>
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

      <div className="db" style={{ gap: '16px' }}>
        {/* Warning Card */}
        <div
          style={{
            background: isOwner ? '#FFF1EE' : 'var(--lilac)',
            border: '2px solid var(--line)',
            borderRadius: '24px 24px 24px 10px',
            boxShadow: '4px 4px 0 var(--line)',
            padding: '18px 20px',
            color: 'var(--on)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isOwner ? (
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--tomato)', flexShrink: 0 }} />
            ) : (
              <LogOut className="w-5 h-5" style={{ color: 'var(--ink)', flexShrink: 0 }} />
            )}
            <strong
              style={{
                fontFamily: 'var(--font-bricolage), Bricolage Grotesque, sans-serif',
                fontSize: '1.15rem',
                fontWeight: 800,
                color: isOwner ? 'var(--tomato)' : 'var(--ink)',
              }}
            >
              {event.name}
            </strong>
          </div>

          <p style={{ fontSize: '0.92rem', lineHeight: 1.5, margin: 0, fontWeight: 600 }}>
            {isOwner ? (
              <>
                This will move the event and its photos into the trash with a{' '}
                <strong>7-day recovery period</strong> before assets are permanently purged.
              </>
            ) : (
              <>
                You will be removed from this event and it will disappear from your dashboard.
                Photos you contributed will remain in the album.
              </>
            )}
          </p>
        </div>

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

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '8px',
          }}
        >
          <button
            type="button"
            className="btn sm"
            onClick={onClose}
            disabled={isLoading}
            style={{ background: '#fff' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn go"
            onClick={handleConfirmAction}
            disabled={isLoading}
            style={{
              background: isOwner ? 'var(--tomato)' : 'var(--ink)',
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isOwner ? 'Deleting...' : 'Leaving...'}
              </>
            ) : (
              <>
                {isOwner ? <Trash2 className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                {actionTitle}
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}
