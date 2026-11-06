/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Camera, Plus, LogOut, User as UserIcon, Sparkles, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Navbar({ onOpenCreateModal }: { onOpenCreateModal?: () => void }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === '/' || pathname === '/auth/signin' || pathname === '/events') {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full px-3 sm:px-6 pt-3 pb-1">
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between px-4 sm:px-6 rounded-full border-2 border-stone-200/80 bg-white/85 shadow-sm shadow-purple-950/5 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/85">
        {/* Logo / Brand with cute sparkle accent */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white shadow-sm shadow-pink-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-200">
            <Camera className="h-4.5 w-4.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-black tracking-tight text-stone-900 dark:text-stone-100 font-sans">
              LoveAll
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 dark:from-purple-950 dark:to-pink-950 dark:text-pink-300 border border-pink-200/60 dark:border-pink-800/60">
              <Sparkles className="w-2.5 h-2.5 text-pink-500" />
              AI
            </span>
          </div>
        </Link>

        {/* Navigation & User actions */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {status === 'authenticated' && session.user ? (
            <>
              <Link
                href="/events"
                className="text-xs sm:text-sm font-bold text-stone-600 hover:text-purple-600 dark:text-stone-300 dark:hover:text-purple-400 px-3 py-1.5 rounded-full hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
              >
                Events
              </Link>

              {onOpenCreateModal ? (
                <Button size="sm" variant="primary" onClick={onOpenCreateModal} className="gap-1.5 shadow-xs">
                  <Plus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">New Event</span>
                </Button>
              ) : (
                <Link href="/events/new">
                  <Button size="sm" variant="primary" className="gap-1.5 shadow-xs">
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">New Event</span>
                  </Button>
                </Link>
              )}

              {/* User avatar and sign out with pastel border ring */}
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="h-8 w-8 rounded-full border-2 border-pink-300 ring-2 ring-purple-100 dark:border-pink-700 dark:ring-purple-900 object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-100 to-purple-100 text-purple-600 dark:from-purple-950 dark:to-pink-950 dark:text-pink-300 border border-purple-200">
                    <UserIcon className="h-4 w-4" />
                  </div>
                )}
                <span className="hidden md:inline text-xs font-bold text-stone-700 dark:text-stone-300 max-w-[120px] truncate">
                  {session.user.name || session.user.email}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  title="Sign out"
                  className="px-2 h-8 w-8 text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            </>
          ) : (
            <Link href="/auth/signin">
              <Button size="sm" variant="primary" className="px-5 shadow-xs">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
