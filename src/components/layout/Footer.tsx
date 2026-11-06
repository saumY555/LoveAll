'use client';

import React from 'react';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <p>© 2026 EventPhoto AI. Fast collaborative gallery & people discovery.</p>
          <div className="flex items-center gap-6">
            <span>Server-Verified Permissions</span>
            <span>Private Storage</span>
            <span>Consent-First AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
