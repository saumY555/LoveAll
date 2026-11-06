/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { Calendar, Users, Image as ImageIcon, Sparkles, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import { EventWithRole } from '@/types';

interface EventCardProps {
  event: EventWithRole;
}

export function EventCard({ event }: EventCardProps) {
  const isOwner = event.userRole === 'OWNER';

  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative flex flex-col overflow-hidden rounded-3xl border-2 border-stone-200/80 bg-white/95 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-purple-300 dark:border-stone-800 dark:bg-stone-900/95 dark:hover:border-purple-700"
    >
      {/* Cover Image or Playful Pastel Gradient fallback */}
      <div className="relative aspect-video w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-pink-100 via-purple-100 to-sky-100 dark:from-purple-950/60 dark:via-pink-950/40 dark:to-sky-950/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 dark:bg-stone-900/80 text-purple-600 dark:text-purple-300 shadow-xs group-hover:scale-110 group-hover:rotate-6 transition-transform">
              <ImageIcon className="h-6 w-6" />
            </div>
          </div>
        )}

        {/* Role Badge Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {isOwner ? (
            <Badge variant="lavender" className="shadow-xs backdrop-blur-md px-3 py-1">
              <Crown className="w-3 h-3 mr-1 text-purple-600" />
              Owner
            </Badge>
          ) : (
            <Badge variant="sky" className="shadow-xs backdrop-blur-md px-3 py-1">
              Member
            </Badge>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
          {event.name}
        </h3>

        {event.description && (
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Metadata Footer */}
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>{event.eventDate ? formatDate(event.eventDate) : 'No date'}</span>
          </div>

          <div className="flex items-center gap-3 font-semibold">
            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400" title="Members">
              <Users className="w-3.5 h-3.5" />
              <span>{event._count?.members || 1}</span>
            </div>
            <div className="flex items-center gap-1 text-pink-600 dark:text-pink-400" title="Photos">
              <ImageIcon className="w-3.5 h-3.5" />
              <span>{event._count?.photos || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
