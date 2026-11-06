'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, ShieldAlert, KeyRound, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignInPage() {
  const router = useRouter();

  // Guest Passcode State
  const [passcode, setPasscode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isJoiningPasscode, setIsJoiningPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Dev Login State
  const [devEmail, setDevEmail] = useState('alice@example.com');
  const [devName, setDevName] = useState('Alice Cooper');
  const [isDevLoading, setIsDevLoading] = useState(false);

  // General Status & Feedback
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDev = process.env.NODE_ENV === 'development';

  const handleJoinByPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = passcode.trim();
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

      // Successfully joined as guest -> redirect directly to the event gallery
      router.push(`/events/${data.eventId}`);
    } catch (err: unknown) {
      setPasscodeError((err as Error).message);
      setIsJoiningPasscode(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleNotice(null);

    try {
      const res = await signIn('google', { callbackUrl: '/events', redirect: false });
      if (res?.error) {
        if (res.error === 'Configuration' || res.error.includes('OAuth')) {
          setGoogleNotice(
            'Google OAuth credentials (AUTH_GOOGLE_ID & AUTH_GOOGLE_SECRET) are not configured in .env yet. You can join directly with an Event Passcode above or use the test login below.'
          );
        } else {
          setError(res.error);
        }
      }
    } catch {
      setGoogleNotice(
        'Google OAuth is not configured with live credentials in .env yet. Please use the Event Passcode above or the test login below.'
      );
    }
  };

  const handleDevSignIn = async (email: string, name: string) => {
    setIsDevLoading(true);
    setError(null);
    try {
      await signIn('dev-login', {
        email,
        name,
        callbackUrl: '/events',
      });
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsDevLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
            <Camera className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Welcome to EventPhoto
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            View shared galleries, find people with AI, and upload memories.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 1. Guest Event Passcode Access (No sign-in required) */}
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
            <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Join Event with Passcode</span>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            Enter the passcode provided by the event host to access the gallery directly as a guest.
          </p>

          <form onSubmit={handleJoinByPasscode} className="space-y-2.5 pt-1">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="PASSCODE (e.g. NEP26)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono uppercase font-bold tracking-wider text-zinc-900 dark:text-zinc-100 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={isJoiningPasscode}
                className="h-10 px-4 text-xs font-semibold shrink-0 gap-1"
              >
                <span>Enter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <input
              type="text"
              placeholder="Your Name (Optional, for photo uploads)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {passcodeError && (
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400 pt-0.5">
                {passcodeError}
              </p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <span className="relative bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase tracking-wider text-zinc-400">
            or sign in with account
          </span>
        </div>

        {/* 2. Google OAuth Sign-in */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Sign In with Google
          </button>

          {googleNotice && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 p-3 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span>{googleNotice}</span>
            </div>
          )}
        </div>

        {/* 3. Development Auth Section: Local Testing Accounts */}
        {isDev && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Development Testing Accounts</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Isolated shortcut for local testing.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDevSignIn('alice@example.com', 'Alice Cooper (Owner)')}
                disabled={isDevLoading}
                className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer text-center"
              >
                Sign in as Alice
              </button>
              <button
                type="button"
                onClick={() => handleDevSignIn('bob@example.com', 'Bob Martin (Member)')}
                disabled={isDevLoading}
                className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer text-center"
              >
                Sign in as Bob
              </button>
            </div>

            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-900/40 space-y-2">
              <Input
                label="Custom Test Email"
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-zinc-800"
              />
              <Input
                label="Custom Test Name"
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                className="h-8 text-xs bg-white dark:bg-zinc-800"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDevSignIn(devEmail, devName)}
                isLoading={isDevLoading}
                className="w-full text-xs"
              >
                Sign in with custom dev profile
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
