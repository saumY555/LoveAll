'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, ShieldAlert, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function EventSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [allowGuestView, setAllowGuestView] = useState(false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch(`/api/events/${eventId}`);
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            setError(data.error || 'Failed to fetch event settings');
          } else if (data.event.userRole !== 'OWNER') {
            setError('Only the event owner can access settings');
          } else {
            setName(data.event.name || '');
            setDescription(data.event.description || '');
            setEventDate(
              data.event.eventDate ? new Date(data.event.eventDate).toISOString().split('T')[0] : ''
            );
            setCoverImage(data.event.coverImage || '');
            setIsPrivate(data.event.isPrivate ?? true);
            setAllowGuestView(data.event.allowGuestView ?? false);
            setAllowGuestUpload(data.event.allowGuestUpload ?? false);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [eventId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Event name is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
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
      if (!res.ok) throw new Error(data.error || 'Failed to update event');

      setSuccessMessage('Event settings updated successfully.');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        'Are you sure you want to delete this event? The event will enter a 7-day recovery period before assets are permanently purged.'
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete event');

      alert('Event soft-deleted. You can recover it within 7 days.');
      router.push('/events');
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
      <Link
        href={`/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Event Gallery
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Event Settings
          </h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Manage event details, visitor permissions, and lifecycle.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <Input
            label="Event Name"
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
              label="Cover Image URL"
              type="url"
              placeholder="https://example.com/cover.jpg"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white p-2.5 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {/* Permissions Settings */}
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
                <p className="text-zinc-500">Only invited members can access without an authorized link</p>
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
                <p className="text-zinc-500">Shareable link visitors can view without an account</p>
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
                <p className="text-zinc-500">Shareable link visitors can contribute photos</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Save Changes
            </Button>
          </div>
        </form>

        {/* Danger Zone: Soft Deletion */}
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/60 dark:bg-red-950/20 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Danger Zone</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Deleting an event moves it to trash with a 7-day recovery window. After 7 days, photos
            and metadata without other references are permanently purged.
          </p>
          <div className="pt-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Event (7-day recovery)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
