/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Calendar,
  Users,
  Settings,
  Upload,
  Image as ImageIcon,
  ShieldCheck,
  ArrowLeft,
  Loader2,
  Lock,
  Share2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MemberManagerModal } from '@/components/events/MemberManagerModal';
import { EventSettingsModal } from '@/components/events/EventSettingsModal';
import { ShareModal } from '@/components/events/ShareModal';
import { UploadDropzoneModal } from '@/components/photos/UploadDropzoneModal';
import {
  PhotoThumbnailCard,
  GalleryPhoto,
} from '@/components/photos/PhotoThumbnailCard';
import { PhotoLightboxModal } from '@/components/photos/PhotoLightboxModal';
import { FaceDiscoveryBar } from '@/components/photos/FaceDiscoveryBar';
import { formatDate } from '@/lib/utils';
import { EventWithRole } from '@/types';

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { data: session } = useSession();

  const [event, setEvent] = useState<EventWithRole | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [totalPhotosCount, setTotalPhotosCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPhotosLoading, setIsPhotosLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'any'>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTogglePerson = (personId: string) => {
    setSelectedPersonIds((prev) => {
      if (prev.includes('none')) {
        return [personId];
      }
      if (prev.includes(personId)) {
        return prev.filter((id) => id !== personId);
      }
      return [...prev, personId];
    });
  };

  const handleClearPeople = () => {
    setSelectedPersonIds([]);
  };

  const handleSelectOtherPhotos = () => {
    setSelectedPersonIds(['none']);
  };

  // Load Event Details & Photos concurrently in parallel
  useEffect(() => {
    let ignore = false;
    async function loadData() {
      try {
        const photosParams = new URLSearchParams({ limit: '500' });
        if (selectedPersonIds.includes('none')) {
          photosParams.set('personId', 'none');
        } else if (selectedPersonIds.length > 0) {
          photosParams.set('personIds', selectedPersonIds.join(','));
          if (selectedPersonIds.length > 1) {
            photosParams.set('mode', filterMode);
          }
        }
        const photosUrl = `/api/events/${eventId}/photos?${photosParams.toString()}`;

        const [eventRes, photosRes] = await Promise.all([
          fetch(`/api/events/${eventId}`),
          fetch(photosUrl),
        ]);

        const [eventData, photosData] = await Promise.all([
          eventRes.json(),
          photosRes.json(),
        ]);

        if (!ignore) {
          if (!eventRes.ok) {
            setError(eventData.error || 'Failed to load event details');
          } else {
            setEvent(eventData.event);
          }

          if (photosRes.ok) {
            setPhotos(photosData.photos || []);
            setTotalPhotosCount(photosData.pagination?.totalCount ?? photosData.photos?.length ?? 0);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
          setIsPhotosLoading(false);
        }
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [eventId, refreshKey, selectedPersonIds, filterMode]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs text-zinc-500">Loading event gallery...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 mb-4">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Access Restricted</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {error || 'You do not have permission to view this event.'}
        </p>
        <Link href="/events" className="mt-6 inline-block">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Events
          </Button>
        </Link>
      </div>
    );
  }

  const isOwner = event.userRole === 'OWNER';
  const canUpload = !!event.userRole || (event.isGuest ? !!event.canGuestUpload : event.allowGuestUpload);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Top back navigation */}
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Events
      </Link>

      {/* Guest Notice Banner */}
      {event.isGuest && (
        <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-xs">
              {event.guestIdentity?.displayName?.[0]?.toUpperCase() || 'G'}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Viewing as Guest: <span className="text-indigo-600 dark:text-indigo-400">{event.guestIdentity?.displayName || 'Anonymous Guest'}</span>
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {event.canGuestUpload
                  ? 'You have upload permissions enabled. You can upload photos directly to this gallery.'
                  : 'You have view-only access for this event gallery.'}
              </p>
            </div>
          </div>
          <Badge variant={event.canGuestUpload ? 'success' : 'default'} className="self-start sm:self-auto shrink-0 text-xs py-1 px-3">
            {event.canGuestUpload ? 'Upload Allowed' : 'View Only'}
          </Badge>
        </div>
      )}

      {/* Event Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        {event.coverImage && (
          <div className="relative h-48 sm:h-64 w-full overflow-hidden">
            <img
              src={event.coverImage}
              alt={event.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>
        )}

        <div className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {event.name}
                </h1>

                {isOwner ? (
                  <Badge variant="purple" className="py-1">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    You are Owner
                  </Badge>
                ) : event.userRole === 'MEMBER' ? (
                  <Badge variant="primary" className="py-1">
                    Member
                  </Badge>
                ) : (
                  <Badge variant="default" className="py-1">
                    Guest View
                  </Badge>
                )}
              </div>

              {event.description && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
                  {event.description}
                </p>
              )}

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <span>{event.eventDate ? formatDate(event.eventDate) : 'No date set'}</span>
                </div>

                <button
                  onClick={() => setIsMemberModalOpen(true)}
                  className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span className="font-medium underline decoration-dotted">
                    {event._count?.members || 1} Participants
                  </span>
                </button>

                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  <span>{photos.length} Photos</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {!event.isGuest && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMemberModalOpen(true)}
                  className="gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Members
                </Button>
              )}

              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  onClick={() => setIsShareModalOpen(true)}
                >
                  <Share2 className="w-4 h-4" />
                  Share & QR
                </Button>
              )}

              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsSettingsModalOpen(true)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Button>
              )}

              {canUpload && (
                <Button
                  variant="primary"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <Upload className="w-4 h-4" />
                  Upload Photos
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Face Discovery & Clustering Bar */}
      <div className="mt-8">
        <FaceDiscoveryBar
          eventId={event.id}
          selectedPersonIds={selectedPersonIds}
          filterMode={filterMode}
          onTogglePerson={handleTogglePerson}
          onClearPeople={handleClearPeople}
          onSelectOtherPhotos={handleSelectOtherPhotos}
          onModeChange={setFilterMode}
          totalMatchCount={totalPhotosCount}
          onRefreshPhotos={() => setRefreshKey((k) => k + 1)}
          canManage={isOwner || !!event.userRole}
        />
      </div>

      {/* Main Photo Gallery */}
      <section className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-2">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Gallery ({totalPhotosCount || photos.length})
              </h2>
              {selectedPersonIds.length > 0 && (
                <button
                  onClick={handleClearPeople}
                  className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
                >
                  <span>
                    {selectedPersonIds.includes('none')
                      ? 'Other Photos'
                      : selectedPersonIds.length === 1
                      ? '1 Person Filtered'
                      : `${selectedPersonIds.length} People (${filterMode === 'all' ? 'Together' : 'Either'})`}
                  </span>
                  <span className="opacity-70 text-[10px]">✕ Clear</span>
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              Thumbnail-first fast grid. Click any picture to preview or download high-res original.
            </p>
          </div>

          {photos.length > 0 && canUpload && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUploadModalOpen(true)}
              className="gap-1.5 self-start sm:self-auto"
            >
              <Upload className="w-3.5 h-3.5" />
              Add More Photos
            </Button>
          )}
        </div>

        {/* Loading Photos Skeleton */}
        {isPhotosLoading ? (
          <div className="mt-8 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : photos.length === 0 ? (
          /* Empty State */
          <div className="mt-8 flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 py-16 px-6 text-center dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
            {selectedPersonIds.length >= 2 && filterMode === 'all' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 mb-4 shadow-2xs">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {selectedPersonIds.length === 2
                    ? 'No photos with both of them together'
                    : 'No photos with all of them together'}
                </h3>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  None of the photos contain all {selectedPersonIds.length} selected people in the same frame. Try switching to <strong>Either</strong> to see photos of any of them.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setFilterMode('any')}
                    className="gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    Switch to Either
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClearPeople}
                  >
                    Clear Filter
                  </Button>
                </div>
              </>
            ) : selectedPersonIds.length > 0 ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 mb-4 shadow-2xs">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No matching photos found
                </h3>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  No photos found matching your current face filter.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-6"
                  onClick={handleClearPeople}
                >
                  Clear Filter
                </Button>
              </>
            ) : (
              <>
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 mb-4 shadow-2xs">
                  <ImageIcon className="h-8 w-8" />
                </div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  No photos uploaded yet
                </h3>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  Be the first to contribute! Upload your pictures from this event to share with everyone.
                </p>
                {canUpload && (
                  <Button
                    size="sm"
                    className="mt-6 gap-2"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Photos
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          /* Responsive Photo Grid */
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {photos.map((photo) => (
              <PhotoThumbnailCard
                key={photo.id}
                photo={photo}
                isOwner={isOwner}
                currentUserId={session?.user?.id}
                onPhotoClick={(p) => setLightboxPhoto(p)}
                onPhotoDeleted={(deletedId) => {
                  setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Multi-Photo Upload Dropzone Modal */}
      <UploadDropzoneModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        eventId={event.id}
        onUploadComplete={() => {
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Photo Lightbox Preview Modal */}
      <PhotoLightboxModal
        photos={photos}
        currentPhoto={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={(nextPhoto) => setLightboxPhoto(nextPhoto)}
      />

      {/* Member Management Modal */}
      <MemberManagerModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        eventId={event.id}
        isOwner={isOwner}
        currentUserId={session?.user?.id}
        initialMembers={event.members || []}
        onMembersUpdated={() => setRefreshKey((k) => k + 1)}
      />

      {/* Event Settings Modal (Instant 0ms display) */}
      {isOwner && (
        <EventSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          event={event}
          onEventUpdated={(updated) => {
            setEvent((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...updated,
                eventDate: updated.eventDate
                  ? new Date(updated.eventDate)
                  : updated.eventDate === null
                  ? null
                  : prev.eventDate,
              };
            });
          }}
        />
      )}

      {/* Share & QR Code Modal */}
      {isOwner && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          eventId={event.id}
          eventName={event.name}
        />
      )}
    </div>
  );
}
