'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, KeyRound, ArrowRight, Sparkles, Smile, ShieldCheck, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
            'Google OAuth credentials are not configured in .env yet. You can join directly with an Event Passcode above or use the test login below.'
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
      <div className="w-full max-w-md rounded-3xl border-2 border-stone-200/90 bg-white/95 p-6 sm:p-8 shadow-xl shadow-purple-950/5 dark:border-stone-800 dark:bg-stone-900/95 space-y-6 backdrop-blur-md">
        {/* Brand Header with playful sparkles */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white shadow-md shadow-pink-500/20 animate-float">
            <Camera className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-stone-100 flex items-center justify-center gap-1.5">
            <span>Welcome to LoveAll</span>
            <Sparkles className="w-4 h-4 text-pink-500" />
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
            Shared event albums, AI face tags, and instant downloads.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* 1. Guest Event Passcode Access (No sign-in required) */}
        <div className="rounded-3xl border-2 border-purple-200 bg-purple-50/70 p-5 dark:border-purple-900/60 dark:bg-purple-950/30 space-y-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
              <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Join Event with Passcode</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Guest Access
            </span>
          </div>

          <p className="text-[11px] text-stone-600 dark:text-stone-400 font-medium leading-relaxed">
            Have a passcode from the host (e.g. <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-100/80 px-1 py-0.5 rounded">NEPAL26</span>)? Jump directly into the gallery!
          </p>

          <form onSubmit={handleJoinByPasscode} className="space-y-2.5 pt-1">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="PASSCODE"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                className="flex-1 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-stone-800 px-4 py-2.5 text-sm font-mono uppercase font-black tracking-widest text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 shadow-2xs"
                required
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={isJoiningPasscode}
                className="h-11 px-5 text-xs font-bold shrink-0 gap-1.5 shadow-sm"
              >
                <span>Enter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            <input
              type="text"
              placeholder="Your name (optional, shown on photos you upload)"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 dark:border-stone-700 bg-white/90 dark:bg-stone-800/90 px-3.5 py-2 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-purple-400"
            />

            {passcodeError && (
              <p className="text-[11px] font-bold text-rose-600 dark:text-rose-400 pt-1">
                ⚠️ {passcodeError}
              </p>
            )}
          </form>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-800" />
          <span className="relative bg-white px-3 text-[11px] font-bold text-stone-400 dark:bg-stone-900 uppercase tracking-wider">
            or sign in
          </span>
        </div>

        {/* 2. Google OAuth Button */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-full border-2 border-stone-200 bg-white py-2.5 px-4 text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-50 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-750 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {googleNotice && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/40 dark:text-amber-300">
              <p className="font-semibold">{googleNotice}</p>
            </div>
          )}
        </div>

        {/* 3. Dev Quick Login (Development Mode) */}
        {isDev && (
          <div className="rounded-3xl border-2 border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-850 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
              <span>Quick Test Accounts</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold dark:bg-emerald-950 dark:text-emerald-300">
                Dev Mode
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDevSignIn('alice@example.com', 'Alice Cooper')}
                disabled={isDevLoading}
                className="p-2.5 rounded-2xl border-2 border-purple-200 bg-white hover:bg-purple-50 text-stone-800 text-left transition-all cursor-pointer dark:bg-stone-800 dark:border-purple-900 dark:text-stone-200"
              >
                <div className="text-xs font-bold truncate">🌸 Alice Cooper</div>
                <div className="text-[10px] text-stone-400 truncate">Host & Owner</div>
              </button>

              <button
                type="button"
                onClick={() => handleDevSignIn('bob@example.com', 'Bob Builder')}
                disabled={isDevLoading}
                className="p-2.5 rounded-2xl border-2 border-sky-200 bg-white hover:bg-sky-50 text-stone-800 text-left transition-all cursor-pointer dark:bg-stone-800 dark:border-sky-900 dark:text-stone-200"
              >
                <div className="text-xs font-bold truncate">🛠️ Bob Builder</div>
                <div className="text-[10px] text-stone-400 truncate">Member</div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
