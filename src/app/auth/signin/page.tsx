'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Camera, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SignInPage() {
  const [devEmail, setDevEmail] = useState('alice@example.com');
  const [devName, setDevName] = useState('Alice Cooper');
  const [isDevLoading, setIsDevLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // In production, Next.js build-time replaces process.env.NODE_ENV with 'production'
  const isDev = process.env.NODE_ENV === 'development';

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/events' });
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
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
            <Camera className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Welcome to EventPhoto
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Sign in to access your shared event galleries and upload photos.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Standard Google OAuth Sign-in */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750 transition-colors cursor-pointer"
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
        </div>

        {/* Development Auth Section: STRICTLY ISOLATED TO LOCAL DEVELOPMENT */}
        {isDev && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Development Testing Accounts</span>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Isolated shortcut for local offline testing. Omitted in production builds.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleDevSignIn('alice@example.com', 'Alice Cooper (Owner)')}
                disabled={isDevLoading}
                className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer text-center"
              >
                Sign in as Alice
              </button>
              <button
                type="button"
                onClick={() => handleDevSignIn('bob@example.com', 'Bob Martin (Member)')}
                disabled={isDevLoading}
                className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 cursor-pointer text-center"
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
