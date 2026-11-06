'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

interface PasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PasscodeModal({ isOpen, onClose, onSuccess }: PasscodeModalProps) {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setDisplayName('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = passcode.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/events/join-by-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: cleanCode,
          displayName: displayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired passcode');
      }

      onClose();
      if (onSuccess) onSuccess();
      router.push(`/events/${data.eventId}`);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to join event');
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="passcode-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(59, 43, 38, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--lilac)',
          border: '2px solid var(--line)',
          borderRadius: '32px 10px 32px 32px',
          boxShadow: '6px 6px 0 var(--line)',
          padding: '28px',
          color: 'var(--on)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2
              id="passcode-title"
              style={{
                fontFamily: 'var(--font-bricolage), sans-serif',
                fontWeight: 800,
                fontSize: '1.6rem',
                margin: '0 0 6px',
              }}
            >
              Join with a passcode
            </h2>
            <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>
              Got a passcode from the host, like ABC123? Go straight to the gallery.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="icon-btn"
            style={{ width: '38px', height: '38px', flexShrink: 0 }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '6px 12px',
              background: '#fff',
              border: '2px solid var(--line)',
              borderRadius: '99px',
              color: '#b91c1c',
              fontSize: '0.85rem',
              fontWeight: 700,
              margin: '12px 0',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleJoin} style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              id="modal-code"
              maxLength={6}
              placeholder="PASSCODE"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="go"
              aria-label="Event passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value.toUpperCase())}
              required
              style={{
                flex: 1,
                minHeight: '52px',
                padding: '0 18px',
                border: '2px solid var(--line)',
                borderRadius: '18px',
                background: '#fff',
                color: 'var(--on)',
                fontWeight: 800,
                fontSize: '1.2rem',
                letterSpacing: '.22em',
                textTransform: 'uppercase',
              }}
            />
            <button
              type="submit"
              className="btn alt"
              disabled={loading}
              style={{ padding: '0 24px', flexShrink: 0 }}
            >
              {loading ? 'Joining...' : 'Enter'}
            </button>
          </div>

          <input
            id="modal-guest-name"
            autoComplete="name"
            placeholder="Your name (optional, shown on photos you upload)"
            aria-label="Your name, optional"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={{
              width: '100%',
              minHeight: '52px',
              padding: '0 18px',
              border: '2px solid var(--line)',
              borderRadius: '18px',
              background: '#fff',
              color: 'var(--on)',
              fontWeight: 600,
              fontSize: '1rem',
            }}
          />
        </form>
      </div>
    </div>
  );
}
