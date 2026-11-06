/* eslint-disable @next/next/no-img-element */
import React from 'react';
import Link from 'next/link';
import { Calendar, Users, Image as ImageIcon, ShieldCheck } from 'lucide-react';
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
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Cover Image or Gradient fallback */}
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {event.coverImage ? (
          <img
            src={event.coverImage}
            alt={event.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10">
            <ImageIcon className="h-10 w-10 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
          </div>
        )}

        {/* Role Badge Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {isOwner ? (
            <Badge variant="purple" className="shadow-xs backdrop-blur-md">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Owner
            </Badge>
          ) : (
            <Badge variant="primary" className="shadow-xs backdrop-blur-md">
              Member
            </Badge>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
          {event.name}
        </h3>

        {event.description && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Metadata Footer */}
        <div className="mt-auto pt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-400" />
            <span>{event.eventDate ? formatDate(event.eventDate) : 'No date set'}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" title="Members">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span>{event._count?.members || 1}</span>
            </div>
            <div className="flex items-center gap-1" title="Photos">
              <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
              <span>{event._count?.photos || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
