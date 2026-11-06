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
        <div className="flex items-start gap-3 rounded-2xl bg-red-50 dark:bg-red-950/30 p-4 border border-red-200 dark:border-red-900/40">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="text-xs text-red-900 dark:text-red-200 space-y-1">
            <p className="font-semibold text-sm">This action cannot be undone.</p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {isOwner
                ? `As the event owner, removing these ${count} photo(s) will delete them from the shared gallery for all participants.`
                : `These ${count} photo(s) uploaded by you will be permanently removed from this event gallery.`}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <Trash2 className="w-4 h-4" />
            Delete {count} Photo{count === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
