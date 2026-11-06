'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Plus, Camera, Loader2, Sparkles, Smile, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/events/EventCard';
import { CreateEventModal } from '@/components/events/CreateEventModal';
import { EventWithRole } from '@/types';

export default function EventsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [events, setEvents] = useState<EventWithRole[]>([]);
  const [filter, setFilter] = useState<'all' | 'owned' | 'joined'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (status !== 'authenticated') return;

    let ignore = false;
    async function load() {
      try {
        const res = await fetch('/api/events');
        const data = await res.json();
        if (!ignore) {
          if (res.ok) {
            setEvents(data.events || []);
          } else {
            setError(data.error || 'Failed to load events');
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
  }, [status, router, reloadKey]);

  const filteredEvents = events.filter((event) => {
    if (filter === 'owned') return event.userRole === 'OWNER';
    if (filter === 'joined') return event.userRole === 'MEMBER';
    return true;
  });

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-pink-100 dark:bg-pink-950 flex items-center justify-center animate-bounce">
            <Sparkles className="h-5 w-5 text-pink-600" />
          </div>
          <p className="text-xs font-bold text-stone-500">Loading your memories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Playful Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-8 border-b-2 border-stone-200/80 dark:border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🎉</span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100">
              Event Galleries
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-medium">
            Shared photo spaces for trips, parties, weddings, and hangouts.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          variant="primary"
          className="gap-2 shadow-sm px-6"
        >
          <Plus className="h-4 w-4" />
          <span>New Event</span>
        </Button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl bg-rose-50 border-2 border-rose-200 p-4 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Playful Pill Filter Tabs */}
      <div className="mt-6 flex items-center gap-2 border-b-2 border-stone-200/60 dark:border-stone-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-purple-600 text-white shadow-xs scale-[1.02]'
              : 'bg-white/80 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 border border-stone-200/80 dark:border-stone-700'
          }`}
        >
          All ({events.length})
        </button>
        <button
          onClick={() => setFilter('owned')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            filter === 'owned'
              ? 'bg-purple-600 text-white shadow-xs scale-[1.02]'
              : 'bg-white/80 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 border border-stone-200/80 dark:border-stone-700'
          }`}
        >
          Organized by Me 👑 ({events.filter((e) => e.userRole === 'OWNER').length})
        </button>
        <button
          onClick={() => setFilter('joined')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
            filter === 'joined'
              ? 'bg-purple-600 text-white shadow-xs scale-[1.02]'
              : 'bg-white/80 text-stone-600 hover:text-stone-900 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 border border-stone-200/80 dark:border-stone-700'
          }`}
        >
          Joined 🤝 ({events.filter((e) => e.userRole === 'MEMBER').length})
        </button>
      </div>

      {/* Events Grid or Cute Empty State */}
      {filteredEvents.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-purple-200/90 bg-white/60 p-12 text-center dark:border-purple-900/60 dark:bg-stone-900/40">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-pink-100 via-purple-100 to-amber-100 text-purple-600 dark:from-purple-950 dark:to-pink-950 dark:text-pink-300 mb-4 shadow-xs">
            <Camera className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
            No events found yet
          </h3>
          <p className="mt-1.5 text-xs text-stone-500 max-w-sm font-medium">
            {filter === 'owned'
              ? "You haven't organized any events yet. Click below to create your first shared album!"
              : filter === 'joined'
              ? "You haven't joined any events yet. Ask an event host for their 6-character Passcode to join!"
              : 'Create an event to start collecting photos from everyone!'}
          </p>
          <div className="mt-6">
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              variant="primary"
              className="gap-2 px-6"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Event</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onEventCreated={(newEvent) => {
          setIsCreateModalOpen(false);
          setReloadKey((k) => k + 1);
          router.push(`/events/${newEvent.id}`);
        }}
      />
    </div>
  );
}
