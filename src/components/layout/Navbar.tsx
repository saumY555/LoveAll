/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Camera, Plus, LogOut, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Navbar({ onOpenCreateModal }: { onOpenCreateModal?: () => void }) {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs group-hover:bg-indigo-700 transition-colors">
            <Camera className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            EventPhoto <span className="text-indigo-600 dark:text-indigo-400">AI</span>
          </span>
        </Link>

        {/* Navigation & User actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {status === 'authenticated' && session.user ? (
            <>
              <Link href="/events" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100">
                My Events
              </Link>

              {onOpenCreateModal ? (
                <Button size="sm" onClick={onOpenCreateModal} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Event</span>
                </Button>
              ) : (
                <Link href="/events/new">
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">New Event</span>
                  </Button>
                </Link>
              )}

              {/* User avatar and sign out */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
                <span className="hidden md:inline text-xs font-medium text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
                  {session.user.name || session.user.email}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  title="Sign out"
                  className="px-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Link href="/auth/signin">
              <Button size="sm" variant="primary">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
