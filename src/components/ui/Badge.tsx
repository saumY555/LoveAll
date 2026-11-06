import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'purple'
    | 'pink'
    | 'lavender'
    | 'butter'
    | 'mint'
    | 'peach'
    | 'sky';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default:
      'bg-stone-100 text-stone-700 border border-stone-200/80 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700',
    primary:
      'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
    success:
      'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    warning:
      'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    danger:
      'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    purple:
      'bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
    pink:
      'bg-pink-50 text-pink-700 border border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-850',
    lavender:
      'bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-850',
    butter:
      'bg-yellow-50 text-yellow-800 border border-yellow-200/90 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-850',
    mint:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-850',
    peach:
      'bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-850',
    sky:
      'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-850',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide shadow-2xs',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
