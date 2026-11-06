'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2, ShieldAlert, Check } from 'lucide-react';

export interface EventSettingsData {
  id: string;
  name: string;
  description: string | null;
  coverImage: string | null;
  eventDate: string | Date | null;
  isPrivate: boolean;
  allowGuestView: boolean;
  allowGuestUpload: boolean;
}

interface EventSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventSettingsData;
  onEventUpdated: (updated: Partial<Omit<EventSettingsData, 'eventDate'>> & { eventDate?: string | Date | null }) => void;
}

export function EventSettingsModal({
  isOpen,
  onClose,
  event,
  onEventUpdated,
}: EventSettingsModalProps) {
  const router = useRouter();

  const [name, setName] = useState(event.name || '');
  const [description, setDescription] = useState(event.description || '');
  const [eventDate, setEventDate] = useState(
    event.eventDate ? new Date(event.eventDate).toISOString().split('T')[0] : ''
  );
  const [coverImage, setCoverImage] = useState(event.coverImage || '');
  const [isPrivate, setIsPrivate] = useState(event.isPrivate ?? true);
  const [allowGuestView, setAllowGuestView] = useState(event.allowGuestView ?? false);
  const [allowGuestUpload, setAllowGuestUpload] = useState(event.allowGuestUpload ?? false);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch(`/api/events/${event.id}`, {
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

      onEventUpdated({
        name: name.trim(),
        description: description.trim() || null,
        eventDate: eventDate || null,
        coverImage: coverImage.trim() || null,
        isPrivate,
        allowGuestView,
        allowGuestUpload,
      });

      setSuccessMessage('Event settings updated successfully.');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 800);
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
      const res = await fetch(`/api/events/${event.id}`, {
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Settings"
      description="Modify event details, visitor permissions, and lifecycle."
      maxWidth="lg"
    >
      <div className="space-y-6">
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

        <form onSubmit={handleSave} className="space-y-4">
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
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border-2 border-stone-200 bg-white/90 p-3 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:border-stone-750 dark:bg-stone-900 dark:text-stone-100 transition-all shadow-2xs"
            />
          </div>

          {/* Access & Sharing Permissions */}
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
                <p className="text-stone-500 font-medium text-[11px]">Only invited members can access without an authorized passcode</p>
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
                <p className="text-stone-500 font-medium text-[11px]">Passcode or share link visitors can view without an account</p>
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
                <p className="text-stone-500 font-medium text-[11px]">Passcode or share link visitors can contribute photos</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="rounded-full">
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="px-6 shadow-sm">
              Save Settings ✨
            </Button>
          </div>
        </form>

        {/* Danger Zone: Soft Deletion */}
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/60 dark:bg-red-950/20 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Danger Zone</span>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            Deleting an event moves it to trash with a 7-day recovery window.
          </p>
          <div className="pt-1">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={isDeleting}
              className="gap-1.5 text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Event (7-day recovery)
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
