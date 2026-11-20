'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { User, Check, Loader2, EyeOff, GitMerge, AlertCircle } from 'lucide-react';

interface RenamePersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  person: {
    id: string;
    name: string;
    thumbnailUrl: string | null;
  } | null;
  isOwner?: boolean;
  allPeople?: Array<{ id: string; name: string }>;
  onRenamed: (personId: string, newName: string) => void;
  onHidden?: (personId: string) => void;
  onMerged?: (sourcePersonId: string, targetPersonId: string) => void;
}

export function RenamePersonModal({
  isOpen,
  onClose,
  eventId,
  person,
  isOwner = false,
  allPeople = [],
  onRenamed,
  onHidden,
  onMerged,
}: RenamePersonModalProps) {
  if (!person || !isOpen) return null;

  return (
    <RenamePersonModalContent
      key={person.id}
      isOpen={isOpen}
      onClose={onClose}
      eventId={eventId}
      person={person}
      isOwner={isOwner}
      allPeople={allPeople.filter((p) => p.id !== person.id)}
      onRenamed={onRenamed}
      onHidden={onHidden}
      onMerged={onMerged}
    />
  );
}

function RenamePersonModalContent({
  isOpen,
  onClose,
  eventId,
  person,
  isOwner,
  allPeople,
  onRenamed,
  onHidden,
  onMerged,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  person: { id: string; name: string; thumbnailUrl: string | null };
  isOwner: boolean;
  allPeople: Array<{ id: string; name: string }>;
  onRenamed: (personId: string, newName: string) => void;
  onHidden?: (personId: string) => void;
  onMerged?: (sourcePersonId: string, targetPersonId: string) => void;
}) {
  const [name, setName] = useState(person.name);
  const [selectedMergeTargetId, setSelectedMergeTargetId] = useState(
    allPeople.length > 0 ? allPeople[0].id : ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isHiding, setIsHiding] = useState(false);
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

  const handleHidePerson = async () => {
    if (
      !confirm(
        `Hide "${person.name}" from the gallery?\n\nThis will remove them from the people strip (useful for statues or passersby). You can restore them anytime.`
      )
    ) {
      return;
    }

    setIsHiding(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/people/${person.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHidden: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to hide person');

      onHidden?.(person.id);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsHiding(false);
    }
  };

  const handleMergePeople = async () => {
    if (!selectedMergeTargetId) return;
    const target = allPeople.find((p) => p.id === selectedMergeTargetId);
    if (!target) return;

    if (
      !confirm(
        `Merge all photos of "${person.name}" into "${target.name}"?\n\nAll recognized faces will be combined into ${target.name}.`
      )
    ) {
      return;
    }

    setIsMerging(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/people/${person.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mergeIntoPersonId: selectedMergeTargetId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to merge person');

      onMerged?.(person.id, selectedMergeTargetId);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Recognized Person"
      description="Rename, merge with another person, or hide statues/passersby from the People list."
      maxWidth="md"
    >
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Current label card */}
        <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-indigo-500/40 bg-zinc-200 dark:bg-zinc-700 shadow-sm">
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
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Currently Selected</p>
            <p className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
              {person.name}
            </p>
          </div>
        </div>

        {/* Section 1: Rename Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Edit Name or Label
          </label>
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice, Rahul, Mom"
              required
              maxLength={50}
              className="flex-1"
            />
            <Button type="submit" size="sm" className="gap-1.5" disabled={isLoading || !name.trim()}>
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </Button>
          </div>
        </form>

        {/* Section 2: Merge Person (e.g. Person 14 into Person 4) */}
        {allPeople.length > 0 && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700/60 space-y-3">
            <div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-indigo-500" />
                Merge with Another Person
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                If the face recognizer created separate clusters for the same person (e.g. with/without glasses), combine them here.
              </p>
            </div>

            <div className="flex gap-2 items-center">
              <select
                value={selectedMergeTargetId}
                onChange={(e) => setSelectedMergeTargetId(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {allPeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    Merge into: {p.name}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleMergePeople}
                disabled={isMerging || !selectedMergeTargetId}
                className="gap-1.5 shrink-0"
              >
                {isMerging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                Merge
              </Button>
            </div>
          </div>
        )}

        {/* Section 3: Hide Person (Statues / passerby) */}
        {isOwner && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Not a human or unwanted person?
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Hide statues, paintings, or passerby faces from the People strip.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleHidePerson}
              disabled={isHiding}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/20"
            >
              {isHiding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
              Hide Person
            </Button>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isLoading || isMerging || isHiding}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
