'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewEventPage() {
  const router = useRouter();
  const { status } = useSession();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [allowGuestView, setAllowGuestView] = useState(false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'unauthenticated') {
    router.push('/auth/signin');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          eventDate: eventDate || undefined,
          coverImage: coverImage.trim() || undefined,
          isPrivate,
          allowGuestView,
          allowGuestUpload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      router.push(`/events/${data.event.id}`);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <Link
        href="/events"
        className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white/80 hover:bg-white border border-stone-200/80 px-4 py-2 rounded-full mb-6 transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98] dark:bg-stone-900 dark:border-stone-800 dark:text-stone-300"
      >
        <ArrowLeft className="w-4 h-4 text-purple-600" />
        Back to Events
      </Link>

      <div className="rounded-3xl border-2 border-stone-200/90 bg-white/90 p-6 sm:p-8 shadow-sm backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-400 to-pink-400 flex items-center justify-center text-white text-lg shadow-xs">
            ✨
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-stone-900 dark:text-stone-100">
              Create a New Event
            </h1>
            <p className="mt-0.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              Set up a shared photo space for your friends, trip, or gathering.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Input
            label="Event Name *"
            placeholder="e.g. Hawaii Reunion 2026, Annual Hackathon"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Event Date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />

            <Input
              label="Cover Image URL (optional)"
              type="url"
              placeholder="https://example.com/cover.jpg"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What memories will we make here?"
              className="w-full rounded-2xl border-2 border-stone-200 bg-white/90 p-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200/60 dark:border-stone-750 dark:bg-stone-900/90 dark:text-stone-100 transition-all duration-150 shadow-2xs"
            />
          </div>

          <div className="rounded-3xl border-2 border-purple-200/90 bg-purple-50/50 p-5 dark:border-purple-900/60 dark:bg-purple-950/30 space-y-3.5">
            <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              Access & Sharing Permissions ✨
            </h4>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4.5 w-4.5 rounded-md border-purple-300 text-purple-600 focus:ring-purple-400 accent-purple-600 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-stone-900 dark:text-stone-100">Private Event</span>
                <p className="text-stone-500 font-medium">Only invited members or guests with a valid passcode/link can view</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestView}
                onChange={(e) => setAllowGuestView(e.target.checked)}
                className="h-4.5 w-4.5 rounded-md border-purple-300 text-purple-600 focus:ring-purple-400 accent-purple-600 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-stone-900 dark:text-stone-100">Allow Guest Viewing</span>
                <p className="text-stone-500 font-medium">Anyone with a share link or passcode can view photos without an account</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestUpload}
                onChange={(e) => setAllowGuestUpload(e.target.checked)}
                className="h-4.5 w-4.5 rounded-md border-purple-300 text-purple-600 focus:ring-purple-400 accent-purple-600 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-stone-900 dark:text-stone-100">Allow Guest Uploads</span>
                <p className="text-stone-500 font-medium">Guests with a share link can upload photos directly into the gallery</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Link href="/events">
              <Button type="button" variant="ghost" disabled={isLoading} className="rounded-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" isLoading={isLoading} className="px-6 shadow-sm">
              Create Event 🎉
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
