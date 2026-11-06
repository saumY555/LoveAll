import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-stone-700 dark:text-stone-300">
            {label}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            'flex h-11 w-full rounded-2xl border-2 border-stone-200 bg-white/90 px-4 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200/60 dark:border-stone-750 dark:bg-stone-900/90 dark:text-stone-100 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs',
            error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-200',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-stone-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
