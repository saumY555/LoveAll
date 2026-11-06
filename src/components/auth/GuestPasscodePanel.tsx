'use client';

import React from 'react';

interface GuestPasscodePanelProps {
  passcode: string;
  setPasscode: (code: string) => void;
  guestName: string;
  setGuestName: (name: string) => void;
  isJoiningPasscode: boolean;
  passcodeError: string | null;
  onJoinPasscode: (e: React.FormEvent) => void;
}

export function GuestPasscodePanel({
  passcode,
  setPasscode,
  guestName,
  setGuestName,
  isJoiningPasscode,
  passcodeError,
  onJoinPasscode,
}: GuestPasscodePanelProps) {
  return (
    <form className="pass" onSubmit={onJoinPasscode} aria-labelledby="pt">
      <div className="ph">
        <h2 id="pt">Join with a passcode</h2>
        <em>Guest</em>
      </div>
      <p>Got a passcode from the host, like ABC123? Go straight to the gallery.</p>
      <div className="row">
        <input
          id="code"
          maxLength={6}
          placeholder="PASSCODE"
          autoComplete="off"
          autoCapitalize="characters"
          enterKeyHint="go"
          aria-label="Event passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value.toUpperCase())}
          required
        />
        <button className="btn alt" type="submit" disabled={isJoiningPasscode}>
          {isJoiningPasscode ? 'Joining...' : 'Enter'}
        </button>
      </div>
      <input
        id="guest"
        autoComplete="name"
        placeholder="Your name (optional, shown on photos you upload)"
        aria-label="Your name, optional"
        value={guestName}
        onChange={(e) => setGuestName(e.target.value)}
      />

      {passcodeError && (
        <div
          role="alert"
          style={{
            marginTop: '10px',
            padding: '6px 12px',
            background: '#fff',
            borderRadius: '99px',
            border: '2px solid var(--line)',
            color: '#b91c1c',
            fontSize: '0.85rem',
            fontWeight: 700,
          }}
        >
          ⚠️ {passcodeError}
        </div>
      )}
    </form>
  );
}
