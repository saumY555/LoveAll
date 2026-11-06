'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, Check } from 'lucide-react';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onConsentUpdated?: () => void;
}

export function PrivacyConsentModal({
  isOpen,
  onClose,
  eventId,
  onConsentUpdated,
}: PrivacyConsentModalProps) {
  const [consent, setConsent] = useState(true);
  const [optedOutAt, setOptedOutAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    async function loadPrivacy() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${eventId}/privacy`);
        const data = await res.json();
        if (active && res.ok) {
          setConsent(data.consentFaceRecognition);
          setOptedOutAt(data.optedOutAt);
        }
      } catch (err: unknown) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadPrivacy();
    return () => {
      active = false;
    };
  }, [isOpen, eventId]);

  const handleToggleConsent = async (newConsent: boolean) => {
    setIsSaving(true);
    setStatusMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/privacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: newConsent }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update privacy settings');

      setConsent(data.consentFaceRecognition);
      setOptedOutAt(data.optedOutAt);
      setStatusMessage(data.message);
      onConsentUpdated?.();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Facial Recognition & Privacy"
      description="Manage how your photos and face features are processed for this event."
      maxWidth="md"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {statusMessage && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Informational Card */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-950/60 dark:bg-indigo-950/30 text-xs text-zinc-600 dark:text-zinc-300 space-y-2">
          <p className="font-semibold text-indigo-950 dark:text-indigo-200">
            How does facial grouping work?
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Facial features are converted into on-device numerical vectors (embeddings).</li>
            <li>Vectors are used strictly to cluster photos of the same person within this event.</li>
            <li>Your facial data is never shared with third parties or used for cross-site tracking.</li>
          </ul>
        </div>

        {/* Current Status Box */}
        {isLoading ? (
          <div className="py-6 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {consent ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {consent ? 'Facial Recognition Enabled' : 'Facial Recognition Disabled (Opted Out)'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {consent
                    ? 'Your face is recognized across event photos to enable 1-click discovery.'
                    : `Opted out on ${optedOutAt ? new Date(optedOutAt).toLocaleDateString() : 'recently'}. Face embeddings are deleted.`}
                </p>
              </div>
            </div>

            <Button
              variant={consent ? 'danger' : 'primary'}
              size="sm"
              disabled={isSaving}
              onClick={() => handleToggleConsent(!consent)}
              className="shrink-0 text-xs"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : consent ? (
                'Opt Out & Purge'
              ) : (
                'Enable Consent'
              )}
            </Button>
          </div>
        )}

        {/* Opt-out Warning Note */}
        {consent && (
          <div className="flex items-start gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              Clicking <strong>Opt Out & Purge</strong> will immediately delete all face recognition embeddings extracted from your uploaded photos and remove you from face clusters.
            </span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
