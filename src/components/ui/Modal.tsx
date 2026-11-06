'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Playful soft backdrop */}
      <div
        className="fixed inset-0 bg-stone-950/45 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div
        className={cn(
          'relative w-full rounded-3xl bg-white/95 p-6 sm:p-7 shadow-2xl shadow-purple-950/10 dark:bg-stone-900/95 border-2 border-stone-200/90 dark:border-stone-800 z-10 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md',
          maxWidths[maxWidth]
        )}
      >
        <div className="flex items-start justify-between pb-4 border-b border-stone-150 dark:border-stone-800/80">
          <div>
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-stone-400 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/40 dark:hover:text-pink-300 transition-all cursor-pointer hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
