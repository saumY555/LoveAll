'use client';

import React from 'react';
import { Heart, Sparkles, Smile } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-stone-200/80 bg-white/70 py-8 dark:border-stone-800 dark:bg-stone-900/60 backdrop-blur-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-1.5 font-medium">
            <span>Made with</span>
            <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500 animate-pulse-subtle" />
            <span>for celebrating memories together.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40">
              🔒 Private & Safe
            </span>
            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40">
              ✨ Consent-First AI
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40">
              ⚡ Lightning Fast
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
