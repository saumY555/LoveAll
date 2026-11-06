'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User, Check, Loader2 } from 'lucide-react';

interface RenamePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  person: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  onRenamed: (personId: string, newName: string) => void;
}

export function RenamePersonModal({
  isOpen,
  onClose,
  eventId,
  person,
  onRenamed,
}: RenamePersonModalProps) {
  if (!person || !isOpen) return null;

  return (
    <RenamePersonModalContent
      key={person.id}
      isOpen={isOpen}
      onClose={onClose}
      eventId={eventId}
      person={person}
      onRenamed={onRenamed}
    />
  );
}

function RenamePersonModalContent({
  isOpen,
  onClose,
  eventId,
  person,
  onRenamed,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  person: { id: string; name: string; thumbnailUrl: string | null };
  onRenamed: (personId: string, newName: string) => void;
}) {
  const [name, setName] = useState(person.name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/people/${person.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update name');

      onRenamed(person.id, name.trim());
      onClose();
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
      title="Name Recognized Person"
      description="Assign a name to this person so attendees can discover their photos quickly."
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-indigo-500/40 bg-zinc-200 dark:bg-zinc-700">
            {person.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.thumbnailUrl}
                alt={person.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                <User className="h-6 w-6" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Current Label</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {person.name}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
            Full Name or Nickname
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alice, Uncle Bob, Rahul"
            autoFocus
            required
            maxLength={50}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="gap-1.5" disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Save Name
          </Button>
        </div>
      </form>
    </Modal>
  );
}
