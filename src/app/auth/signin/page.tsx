'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { SignInHeader } from '@/components/auth/SignInHeader';
import { GuestPasscodePanel } from '@/components/auth/GuestPasscodePanel';
import { DemoAccountsGrid } from '@/components/auth/DemoAccountsGrid';
import { SignInFooter } from '@/components/auth/SignInFooter';

export default function SignInPage() {
  const router = useRouter();

  // Tab State: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guest Passcode State
  const [passcode, setPasscode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isJoiningPasscode, setIsJoiningPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Dev Quick Test Login State
  const [isDevLoading, setIsDevLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    const cleanName = name.trim();

    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }
    if (authMode === 'signup') {
      if (!cleanName) {
        setError('Please enter your name.');
        return;
      }
      if (cleanPassword.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsLoading(true);

    try {
      // 1. Fast pre-validation check against server database
      const checkRes = await fetch('/api/auth/validate-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
          name: cleanName,
          action: authMode,
        }),
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.error || 'Authentication failed');
      }

      // 2. Perform session authentication via NextAuth credentials provider
      await signIn('credentials', {
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName || cleanEmail.split('@')[0],
        action: authMode,
        callbackUrl: '/events',
      });
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  };

  const handleJoinByPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = passcode.trim().toUpperCase();
    if (!cleanCode) return;

    setIsJoiningPasscode(true);
    setPasscodeError(null);

    try {
      const res = await fetch('/api/events/join-by-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: cleanCode,
          displayName: guestName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired passcode');
      }

      router.push(`/events/${data.eventId}`);
    } catch (err: unknown) {
      setPasscodeError((err as Error).message);
      setIsJoiningPasscode(false);
    }
  };

  const handleDevSignIn = async (devEmail: string, devName: string) => {
    setIsDevLoading(true);
    setError(null);
    try {
      await signIn('dev-login', {
        email: devEmail,
        name: devName,
        callbackUrl: '/events',
      });
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsDevLoading(false);
    }
  };

  return (
    <div className="loveall-signin">
      <div className="wrap">
        <SignInHeader />

        <main>
          <section className="card" aria-labelledby="t">
            {/* Tomato Heart Tile */}
            <div className="tile" aria-hidden="true">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.7 4.5 7 4.5c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3.3 0 5.4 3.1 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" />
              </svg>
            </div>

            <h1 id="t">Welcome to loveall</h1>
            <p className="sub">Shared event albums, face tags, and instant downloads.</p>

            {/* Segmented Mode Selector Tabs */}
            <div className="tabs" role="tablist" aria-label="Account">
              <button
                type="button"
                role="tab"
                id="tin"
                aria-selected={authMode === 'signin'}
                onClick={() => {
                  setAuthMode('signin');
                  setError(null);
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                id="tup"
                aria-selected={authMode === 'signup'}
                onClick={() => {
                  setAuthMode('signup');
                  setError(null);
                }}
              >
                Create account
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                style={{
                  marginBottom: '16px',
                  padding: '8px 14px',
                  background: '#fff',
                  borderRadius: '99px',
                  border: '2px solid var(--line)',
                  color: '#b91c1c',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {/* Main Auth Form */}
            <form id="auth" onSubmit={handleSubmit}>
              {authMode === 'signup' && (
                <div className="field" id="nameRow">
                  <label htmlFor="nm">Your name</label>
                  <input
                    id="nm"
                    autoComplete="name"
                    placeholder="How friends will see you"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={authMode === 'signup'}
                  />
                </div>
              )}

              <div className="field">
                <label htmlFor="em">Email</label>
                <input
                  id="em"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="pw">Password</label>
                <div className="pw">
                  <input
                    id="pw"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={authMode === 'signup' ? 'Choose a password' : 'Your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    id="eye"
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button className="btn go full" id="go" type="submit" disabled={isLoading}>
                {isLoading
                  ? authMode === 'signin'
                    ? 'Signing in...'
                    : 'Creating account...'
                  : authMode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
              </button>
            </form>

            <div className="or">or join as a guest</div>

            {/* Guest Passcode Access */}
            <GuestPasscodePanel
              passcode={passcode}
              setPasscode={setPasscode}
              guestName={guestName}
              setGuestName={setGuestName}
              isJoiningPasscode={isJoiningPasscode}
              passcodeError={passcodeError}
              onJoinPasscode={handleJoinByPasscode}
            />

            {/* Demo Quick Accounts */}
            <DemoAccountsGrid onDevSignIn={handleDevSignIn} isLoading={isDevLoading} />
          </section>
        </main>

        <SignInFooter />
      </div>
    </div>
  );
}
