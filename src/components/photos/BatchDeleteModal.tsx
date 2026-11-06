'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Trash2, AlertTriangle } from 'lucide-react';

interface BatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  photoIds: string[];
  isOwner: boolean;
  onDeleted: (deletedIds: string[]) => void;
}

export function BatchDeleteModal({
  isOpen,
  onClose,
  eventId,
  photoIds,
  isOwner,
  onDeleted,
}: BatchDeleteModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = photoIds.length;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/photos/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoIds }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete photos');
      }

      onDeleted(photoIds);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title={`Delete ${count} Photo${count === 1 ? '' : 's'}?`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-3xl bg-rose-50/80 dark:bg-rose-950/30 p-4.5 border-2 border-rose-200 dark:border-rose-900/40">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-xs text-rose-950 dark:text-rose-200 space-y-1">
            <p className="font-bold text-sm">This action is permanent.</p>
            <p className="text-stone-600 dark:text-stone-400 font-medium leading-relaxed">
              {isOwner
                ? `As the event host, deleting these ${count} photo(s) removes them from the shared album for all participants.`
                : `These ${count} photo(s) uploaded by you will be removed from this event gallery.`}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-150 dark:border-stone-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-full"
          >
            Keep Photos
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="gap-2 px-5 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete {count} Photo{count === 1 ? '' : 's'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
