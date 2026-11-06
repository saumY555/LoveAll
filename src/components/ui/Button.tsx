import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'mint'
    | 'peach'
    | 'sky'
    | 'outline'
    | 'danger'
    | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:opacity-50 disabled:pointer-events-none cursor-pointer hover:scale-[1.02] active:scale-[0.98] select-none';

    const variants = {
      primary:
        'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-sm hover:shadow-md hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 shadow-pink-500/15',
      secondary:
        'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/90 shadow-2xs dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60',
      mint:
        'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/90 shadow-2xs dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60',
      peach:
        'bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200/90 shadow-2xs dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/60',
      sky:
        'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200/90 shadow-2xs dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60',
      outline:
        'border-2 border-stone-200 bg-white/90 hover:bg-purple-50/60 hover:border-purple-300 text-stone-800 dark:border-stone-700 dark:bg-stone-900/80 dark:text-stone-200 dark:hover:bg-purple-950/30 dark:hover:border-purple-700 shadow-2xs',
      danger:
        'bg-rose-500 hover:bg-rose-600 text-white shadow-sm hover:shadow-md shadow-rose-500/20',
      ghost:
        'bg-transparent hover:bg-stone-100/80 text-stone-700 dark:text-stone-300 dark:hover:bg-stone-800/80',
    };

    const sizes = {
      sm: 'h-8 px-3.5 text-xs gap-1.5',
      md: 'h-10 px-5 text-sm gap-2',
      lg: 'h-12 px-7 text-base gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
