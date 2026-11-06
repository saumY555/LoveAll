import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Sparkles, ArrowRight, Zap, FolderSync } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden pt-20 pb-28 md:pt-28 md:pb-36 bg-gradient-to-b from-indigo-50/50 via-white to-zinc-50 dark:from-indigo-950/20 dark:via-zinc-950 dark:to-zinc-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI-Powered Collaborative Event Gallery</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 max-w-4xl mx-auto leading-tight">
            One shared gallery for every event photo.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
              Zero hassle finding yours.
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Collect thousands of photos from everyone attending your wedding, trip, or college fest.
            Browse instantly with thumbnail-first previews and discover people seamlessly.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/events">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Sign In with Google
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-4">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Fast Thumbnail-First Gallery
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Never wait for huge original images to load. Progressive WebP previews and thumbnails ensure instant scrolling even with thousands of event photos.
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400 mb-4">
              <FolderSync className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Collaborative Uploads & Deduplication
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Multiple attendees upload to one shared event gallery. Safe SHA-256 asset hashing prevents duplicate storage while preserving individual uploader credits.
            </p>
          </div>

          <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Server-Verified Permissions
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Strict Owner and Member roles enforced on the backend. Private asset storage, configurable guest access, and a 7-day recovery period for deleted events.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
