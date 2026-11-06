'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

import { EventWithRole } from '@/types';

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventCreated?: (newEvent: EventWithRole) => void;
}

export function CreateEventModal({ isOpen, onClose, onEventCreated }: CreateEventModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [allowGuestView, setAllowGuestView] = useState(false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      onClose();
      // Reset state
      setName('');
      setDescription('');
      setEventDate('');
      setCoverImage('');

      if (onEventCreated) {
        onEventCreated(data.event);
      } else {
        router.push(`/events/${data.event.id}`);
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Event"
      description="Set up a shared gallery for your friends, trip, or gathering."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <Input
          label="Event Name *"
          placeholder="e.g. Summer Road Trip 2026, Tech Gala"
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

        {/* Permissions & Sharing toggles */}
        <div className="rounded-3xl border-2 border-purple-200/90 bg-purple-50/50 p-4.5 dark:border-purple-900/60 dark:bg-purple-950/30 space-y-3.5">
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

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading} className="rounded-full">
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading} className="px-6 shadow-sm">
            Create Event 🎉
          </Button>
        </div>
      </form>
    </Modal>
  );
}
