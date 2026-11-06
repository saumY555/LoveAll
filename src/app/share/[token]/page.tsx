/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Calendar,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatDate } from '@/lib/utils';

interface ShareData {
  valid: boolean;
  shareLink: {
    id: string;
    canView: boolean;
    canUpload: boolean;
    expiresAt: string | null;
  };
  event: {
    id: string;
    name: string;
    description: string | null;
    coverImage: string | null;
    eventDate: string | null;
    _count: {
      photos: number;
      members: number;
    };
  };
}

export default function GuestJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function validateToken() {
      try {
        const res = await fetch(`/api/share/${token}`);
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            setError(data.error || 'This link is invalid or expired');
          } else {
            setShareData(data);
          }
        }
      } catch (err: unknown) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    validateToken();
    return () => {
      ignore = true;
    };
  }, [token]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareData) return;

    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/share/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() || 'Guest' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join as guest');

      // Seamlessly navigate to the event gallery page
      router.push(`/events/${shareData.event.id}`);
    } catch (err: unknown) {
      setError((err as Error).message);
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs text-zinc-500">Validating event invite...</p>
        </div>
      </div>
    );
  }

  if (error || !shareData) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 mb-4 shadow-sm">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Invite Unavailable
        </h2>
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          {error || 'This share link has expired or has been revoked by the event owner.'}
        </p>
      </div>
    );
  }

  const { event, shareLink } = shareData;

  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:py-16">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Cover Photo Header */}
        <div className="relative h-44 w-full bg-gradient-to-br from-indigo-600 to-purple-700 overflow-hidden">
          {event.coverImage ? (
            <img
              src={event.coverImage}
              alt=""
              className="h-full w-full object-cover opacity-60"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center opacity-30">
              <Camera className="w-16 h-16 text-white" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">
              You&apos;re Invited to Join
            </span>
            <h1 className="text-xl font-bold truncate mt-0.5">{event.name}</h1>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Details & Stats */}
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            {event.eventDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(event.eventDate)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              <span>{event._count.photos} Photos</span>
            </div>
          </div>

          {event.description && (
            <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3">
              {event.description}
            </p>
          )}

          {/* Guest Capabilities Banner */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 dark:border-indigo-950/60 dark:bg-indigo-950/20 space-y-2">
            <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
              Guest Access Included:
            </span>
            <div className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {shareLink.canView && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Browse high-speed gallery photos</span>
                </div>
              )}
              {shareLink.canUpload && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Upload & share your photos from your phone</span>
                </div>
              )}
            </div>
          </div>

          {/* Guest Name Form */}
          <form onSubmit={handleJoin} className="space-y-4 pt-1">
            <Input
              label="Your Display Name (Optional)"
              placeholder="e.g. Alex or Guest"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              helperText="Shown on photos you upload so friends know who took them."
            />

            <Button
              type="submit"
              size="lg"
              variant="primary"
              isLoading={isJoining}
              className="w-full gap-2 cursor-pointer shadow-md"
            >
              <span>Enter Gallery</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          <p className="text-center text-[11px] text-zinc-400">
            No password or account creation required.
          </p>
        </div>
      </div>
    </div>
  );
}
