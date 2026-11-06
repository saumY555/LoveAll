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
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Create a New Event
        </h1>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Configure details, dates, and collaboration permissions for this event gallery.
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
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
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description (optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, itinerary, or welcome message..."
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Access & Sharing Permissions
            </h4>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 rounded-sm border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Private Event</span>
                <p className="text-zinc-500">Only invited members or guests with a valid link can view</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestView}
                onChange={(e) => setAllowGuestView(e.target.checked)}
                className="h-4 w-4 rounded-sm border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Allow Guest Viewing</span>
                <p className="text-zinc-500">Anyone with a share link can view photos without an account</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={allowGuestUpload}
                onChange={(e) => setAllowGuestUpload(e.target.checked)}
                className="h-4 w-4 rounded-sm border-zinc-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Allow Guest Uploads</span>
                <p className="text-zinc-500">Guests with a share link can upload photos directly</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Link href="/events">
              <Button type="button" variant="ghost" disabled={isLoading}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              Create Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
