import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Zap,
  FolderSync,
  Heart,
  Camera,
  Users,
  KeyRound,
  Download,
  Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center">
      {/* Playful Hero Section */}
      <section className="relative w-full overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center relative z-10">
          {/* Cute pill top badge */}
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-pink-200/80 bg-pink-50/90 px-4 py-1.5 text-xs font-bold text-pink-700 dark:border-pink-900/60 dark:bg-pink-950/50 dark:text-pink-300 mb-8 shadow-xs animate-float">
            <Sparkles className="w-4 h-4 text-pink-500 fill-pink-500 animate-sparkle" />
            <span>AI-Powered Collaborative Event Gallery</span>
            <span className="text-pink-400">✦</span>
          </div>

          {/* Cheerful Large Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-stone-900 dark:text-stone-50 max-w-4xl mx-auto leading-[1.12]">
            One colorful gallery for every event photo.{' '}
            <span className="text-gradient-playful block mt-1">
              Zero hassle finding yours.
            </span>
          </h1>

          {/* Friendly Subtitle */}
          <p className="mt-6 text-base sm:text-xl text-stone-600 dark:text-stone-300 max-w-2xl mx-auto leading-relaxed font-medium">
            Collect thousands of photos from friends attending your college fest, wedding, or weekend roadtrip.
            Browse instantly and discover who is in which photo with friendly AI.
          </p>

          {/* Bouncy CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5 sm:gap-4">
            <Link href="/events" className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto gap-2.5 px-8 shadow-md">
                <span>Start Exploring</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/auth/signin" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2 px-7">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span>Join with Passcode</span>
              </Button>
            </Link>
          </div>

          {/* Cute Floating Social Proof Stickers */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-bold text-stone-600 dark:text-stone-300">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border-2 border-purple-200/80 shadow-xs dark:bg-stone-900/90 dark:border-purple-900/60">
              <span className="text-sm">📸</span>
              <span>100% Original Quality</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border-2 border-pink-200/80 shadow-xs dark:bg-stone-900/90 dark:border-pink-900/60">
              <span className="text-sm">👥</span>
              <span>Find by 2+ Friends</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border-2 border-emerald-200/80 shadow-xs dark:bg-stone-900/90 dark:border-emerald-900/60">
              <span className="text-sm">⚡</span>
              <span>1-Click ZIP Download</span>
            </div>
          </div>
        </div>
      </section>

      {/* Colorful Playful Feature Cards */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-stone-100">
            Why everyone loves sharing here 💖
          </h2>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Simple, private, and designed for pure joy without corporate clutter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Lavender / Pink theme */}
          <div className="group relative flex flex-col rounded-3xl border-2 border-purple-200/90 bg-white/95 p-7 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 dark:border-purple-900/60 dark:bg-stone-900/90">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-100 to-pink-100 text-purple-600 dark:from-purple-950 dark:to-pink-950 dark:text-pink-300 mb-5 group-hover:scale-110 transition-transform">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span>Find Friends Instantly</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 font-bold dark:bg-pink-950 dark:text-pink-300">
                AI Magic
              </span>
            </h3>
            <p className="mt-2.5 text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
              Filter by 1 or multiple people with &ldquo;Together&rdquo; or &ldquo;Either&rdquo; mode. See all photos of you and your best friend side-by-side in one tap!
            </p>
          </div>

          {/* Card 2: Mint / Sky theme */}
          <div className="group relative flex flex-col rounded-3xl border-2 border-emerald-200/90 bg-white/95 p-7 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 dark:border-emerald-900/60 dark:bg-stone-900/90">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-100 to-sky-100 text-emerald-600 dark:from-emerald-950 dark:to-sky-950 dark:text-emerald-300 mb-5 group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span>Ultra-Smooth Scrolling</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-300">
                WebP
              </span>
            </h3>
            <p className="mt-2.5 text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
              Optimized thumbnail-first previews stream seamlessly without draining mobile data or lagging your browser, while high-res originals remain safely preserved.
            </p>
          </div>

          {/* Card 3: Butter Yellow / Peach theme */}
          <div className="group relative flex flex-col rounded-3xl border-2 border-amber-200/90 bg-white/95 p-7 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 dark:border-amber-900/60 dark:bg-stone-900/90">
            <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-100 to-orange-100 text-amber-600 dark:from-amber-950 dark:to-orange-950 dark:text-amber-300 mb-5 group-hover:scale-110 transition-transform">
              <FolderSync className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <span>Zero-Duplicate Sharing</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold dark:bg-amber-950 dark:text-amber-300">
                Smart
              </span>
            </h3>
            <p className="mt-2.5 text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
              Everyone uploads to one communal space. SHA-256 asset hashing prevents duplicate photos while preserving who uploaded what, so nobody wastes storage.
            </p>
          </div>
        </div>
      </section>

      {/* Cute How It Works Section */}
      <section className="w-full max-w-5xl px-4 sm:px-6 py-14">
        <div className="rounded-3xl border-2 border-stone-200/90 bg-gradient-to-br from-purple-50/50 via-white to-pink-50/50 p-8 sm:p-12 text-center dark:border-stone-800 dark:from-purple-950/20 dark:via-stone-900 dark:to-pink-950/20 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 text-xs font-bold text-purple-700 dark:text-purple-300 mb-4">
            <Smile className="w-3.5 h-3.5 text-pink-500" />
            <span>As Easy as 1, 2, 3</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100">
            How It Works
          </h3>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-left">
            <div className="p-4 rounded-2xl bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 shadow-2xs">
              <div className="h-8 w-8 rounded-full bg-pink-500 text-white font-extrabold flex items-center justify-center text-xs mb-3 shadow-xs">
                1
              </div>
              <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Create an Event</h4>
              <p className="text-xs text-stone-500 mt-1">Get an instant 6-character Passcode or QR code to share with friends.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 shadow-2xs">
              <div className="h-8 w-8 rounded-full bg-purple-500 text-white font-extrabold flex items-center justify-center text-xs mb-3 shadow-xs">
                2
              </div>
              <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Drop Your Photos</h4>
              <p className="text-xs text-stone-500 mt-1">Everyone uploads their favorite shots. We make them fast & detect faces.</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 shadow-2xs">
              <div className="h-8 w-8 rounded-full bg-emerald-500 text-white font-extrabold flex items-center justify-center text-xs mb-3 shadow-xs">
                3
              </div>
              <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Filter & Download</h4>
              <p className="text-xs text-stone-500 mt-1">Click any friend&apos;s face chip to view and download all mutual photos in a ZIP.</p>
            </div>
          </div>

          <div className="mt-8">
            <Link href="/events">
              <Button size="md" variant="primary" className="px-6 shadow-sm">
                Get Started Free ✨
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
