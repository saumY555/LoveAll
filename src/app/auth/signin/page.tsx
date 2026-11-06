'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  KeyRound,
  ArrowRight,
  Sparkles,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-3 sm:p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-stone-200/90 bg-white/95 p-6 sm:p-8 shadow-xl shadow-purple-950/5 dark:border-stone-800 dark:bg-stone-900/95 space-y-6 backdrop-blur-md">
        {/* Brand Header */}
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

        {/* 1. Main Auth Box: Sign In / Create Account with Password */}
        <div className="space-y-4">
          {/* Segmented Mode Selector Pill */}
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200/80 dark:border-stone-700">
            <button
              type="button"
              onClick={() => {
                setAuthMode('signin');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white dark:bg-stone-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('signup');
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-stone-900 text-purple-700 dark:text-purple-300 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {authMode === 'signup' && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="e.g. Saumya"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 pl-10 pr-3.5 py-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 shadow-2xs"
                    required={authMode === 'signup'}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 pl-10 pr-3.5 py-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 shadow-2xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                  Password
                </label>
                {authMode === 'signup' && (
                  <span className="text-[10px] text-stone-400">Min. 6 characters</span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border-2 border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 pl-10 pr-10 py-2.5 text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 shadow-2xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full py-3 text-xs font-bold shadow-sm mt-2"
            >
              {authMode === 'signin' ? 'Sign In 🚀' : 'Create Account ✨'}
            </Button>
          </form>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="w-full border-t border-stone-200 dark:border-stone-800" />
          <span className="relative bg-white px-3 text-[11px] font-bold text-stone-400 dark:bg-stone-900 uppercase tracking-wider">
            or join as guest
          </span>
        </div>

        {/* 2. Guest Event Passcode Access */}
        <div className="rounded-3xl border-2 border-purple-200 bg-purple-50/70 p-5 dark:border-purple-900/60 dark:bg-purple-950/30 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
              <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Join Event with Passcode</span>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white dark:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              Guest
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
                className="flex-1 rounded-2xl border-2 border-purple-200 dark:border-purple-800 bg-white dark:bg-stone-800 px-4 py-2 text-sm font-mono uppercase font-black tracking-widest text-stone-900 dark:text-stone-100 placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-stone-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 shadow-2xs"
                required
              />
              <Button
                type="submit"
                variant="primary"
                isLoading={isJoiningPasscode}
                className="h-10 px-5 text-xs font-bold shrink-0 gap-1.5 shadow-sm"
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

        {/* 3. Demo Quick Accounts */}
        <div className="pt-1">
          <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2 text-center">
            Demo Test Accounts
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDevSignIn('alice@example.com', 'Alice Cooper')}
              disabled={isDevLoading}
              className="p-2.5 rounded-2xl border border-purple-200 bg-white hover:bg-purple-50 text-stone-800 text-left transition-all cursor-pointer dark:bg-stone-800 dark:border-purple-900 dark:text-stone-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="text-xs font-bold truncate">🌸 Alice Cooper</div>
              <div className="text-[10px] text-stone-400 truncate">Host & Owner</div>
            </button>

            <button
              type="button"
              onClick={() => handleDevSignIn('bob@example.com', 'Bob Builder')}
              disabled={isDevLoading}
              className="p-2.5 rounded-2xl border border-sky-200 bg-white hover:bg-sky-50 text-stone-800 text-left transition-all cursor-pointer dark:bg-stone-800 dark:border-sky-900 dark:text-stone-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="text-xs font-bold truncate">🛠️ Bob Builder</div>
              <div className="text-[10px] text-stone-400 truncate">Member</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
