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
  Download,
  Trash2,
  CheckSquare,
  Square,
  X,
  Check,
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
import { BatchDeleteModal } from '@/components/photos/BatchDeleteModal';
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

  // Selection & Batch Operations State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Modals
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

  // Toggle selection for an individual photo
  const handleToggleSelectPhoto = (photoId: string) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedPhotoIds([photoId]);
      return;
    }

    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  // Select / Deselect all visible photos
  const handleSelectAll = () => {
    if (selectedPhotoIds.length === photos.length) {
      setSelectedPhotoIds([]);
    } else {
      setSelectedPhotoIds(photos.map((p) => p.id));
    }
  };

  // Exit selection mode
  const handleExitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedPhotoIds([]);
  };

  // Trigger ZIP download for either:
  // 1. Explicitly selected photo IDs, or
  // 2. Active face filter, or
  // 3. All event photos
  const handleDownloadZip = async (photoIdsToDownload?: string[]) => {
    setIsDownloadingZip(true);
    try {
      const query = new URLSearchParams();

      if (photoIdsToDownload && photoIdsToDownload.length > 0) {
        query.set('photoIds', photoIdsToDownload.join(','));
      } else if (selectedPersonIds.length > 0) {
        query.set('personIds', selectedPersonIds.join(','));
        if (selectedPersonIds.length > 1) {
          query.set('mode', filterMode);
        }
      }

      const queryString = query.toString();
      const downloadUrl = `/api/events/${eventId}/photos/download${queryString ? `?${queryString}` : ''}`;

      // Trigger browser download via invisible link
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = '';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to download ZIP archive');
    } finally {
      setTimeout(() => setIsDownloadingZip(false), 2000);
    }
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
    <div className={`mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 ${isSelectionMode ? 'pb-28' : ''}`}>
      {/* Top back navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Events</span>
        </Link>

        {/* Guest Badge if applicable */}
        {event.isGuest && (
          <Badge variant={event.canGuestUpload ? 'success' : 'default'} className="text-[11px] py-0.5 px-2.5">
            Guest: {event.guestIdentity?.displayName || 'Visitor'}
          </Badge>
        )}
      </div>

      {/* Modern Responsive Event Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900 transition-all">
        {event.coverImage && (
          <div className="relative h-40 sm:h-60 w-full overflow-hidden">
            <img
              src={event.coverImage}
              alt={event.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
          </div>
        )}

        <div className="p-4 sm:p-7">
          <div className="flex flex-col gap-4">
            {/* Title & Role Row */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {event.name}
                </h1>
                {isOwner ? (
                  <Badge variant="purple" className="py-0.5 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Owner
                  </Badge>
                ) : event.userRole === 'MEMBER' ? (
                  <Badge variant="primary" className="py-0.5 text-[11px]">
                    Member
                  </Badge>
                ) : null}
              </div>

              {/* Action Buttons Group */}
              <div className="flex items-center gap-2 flex-wrap">
                {!event.isGuest && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMemberModalOpen(true)}
                    className="gap-1.5 text-xs h-8 px-2.5 sm:px-3"
                    title="Manage participants"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Members</span>
                  </Button>
                )}

                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2.5 sm:px-3 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                    onClick={() => setIsShareModalOpen(true)}
                    title="Share event and QR code"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Share</span>
                  </Button>
                )}

                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-2.5 sm:px-3"
                    onClick={() => setIsSettingsModalOpen(true)}
                    title="Event settings"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Settings</span>
                  </Button>
                )}

                {canUpload && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1.5 text-xs h-8 px-3"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </Button>
                )}
              </div>
            </div>

            {event.description && (
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
                {event.description}
              </p>
            )}

            {/* Event Metadata Strip */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                <span>{event.eventDate ? formatDate(event.eventDate) : 'No date'}</span>
              </div>

              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-zinc-400" />
                <span className="underline decoration-dotted font-medium">
                  {event._count?.members || 1} Participants
                </span>
              </button>

              <div className="flex items-center gap-1.5 font-medium text-zinc-700 dark:text-zinc-300">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                <span>{photos.length} Photos</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Face Discovery & Clustering Bar */}
      <div className="mt-6 sm:mt-8">
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

      {/* Gallery Section */}
      <section className="mt-6">
        {/* Gallery Toolbar: Title, Filter Chips, Download All & Select Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-zinc-200 dark:border-zinc-800 gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Gallery
              <Badge variant="default" className="text-[11px] py-0 px-2 font-semibold">
                {photos.length}
              </Badge>
            </h2>

            {/* Active face filter chip */}
            {selectedPersonIds.length > 0 && (
              <button
                onClick={handleClearPeople}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-colors cursor-pointer"
              >
                <span>
                  {selectedPersonIds.includes('none')
                    ? 'Other Photos'
                    : selectedPersonIds.length === 1
                    ? '1 Person'
                    : `${selectedPersonIds.length} People (${filterMode === 'all' ? 'Together' : 'Either'})`}
                </span>
                <X className="w-3 h-3 ml-0.5 opacity-70" />
              </button>
            )}
          </div>

          {/* Gallery Action Controls */}
          {photos.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Download All / Download Filtered Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadZip()}
                isLoading={isDownloadingZip}
                disabled={isDownloadingZip || photos.length === 0}
                className="gap-1.5 text-xs h-8"
                title="Download all photos as a ZIP archive"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>
                  {selectedPersonIds.length > 0
                    ? `Download Filtered (${photos.length})`
                    : `Download All (${photos.length})`}
                </span>
              </Button>

              {/* Multi-Selection Mode Toggle */}
              <Button
                variant={isSelectionMode ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  if (isSelectionMode) {
                    handleExitSelectionMode();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                className="gap-1.5 text-xs h-8"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isSelectionMode ? 'Done' : 'Select'}</span>
              </Button>
            </div>
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
          /* Mobile-Optimized Fast Photo Grid */
          <div className="mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3.5">
            {photos.map((photo) => (
              <PhotoThumbnailCard
                key={photo.id}
                photo={photo}
                isOwner={isOwner}
                currentUserId={session?.user?.id}
                isSelectionMode={isSelectionMode}
                isSelected={selectedPhotoIds.includes(photo.id)}
                onToggleSelect={handleToggleSelectPhoto}
                onPhotoClick={(p) => setLightboxPhoto(p)}
                onPhotoDeleted={(deletedId) => {
                  setPhotos((prev) => prev.filter((p) => p.id !== deletedId));
                  setSelectedPhotoIds((prev) => prev.filter((id) => id !== deletedId));
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Sticky Bottom Floating Batch Action Bar for Mobile & Desktop */}
      {isSelectionMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 shadow-2xl px-4 py-3 transition-transform animate-in slide-in-from-bottom duration-200">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Selection Status & Select All */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
              >
                {selectedPhotoIds.length === photos.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-400" />
                )}
                <span>
                  {selectedPhotoIds.length === photos.length
                    ? 'Deselect All'
                    : `Select All (${photos.length})`}
                </span>
              </button>

              <Badge variant="purple" className="text-xs py-0.5 px-2.5 font-bold">
                {selectedPhotoIds.length} Selected
              </Badge>
            </div>

            {/* Batch Action Buttons: Download Selected, Delete Selected, Cancel */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadZip(selectedPhotoIds)}
                disabled={selectedPhotoIds.length === 0 || isDownloadingZip}
                isLoading={isDownloadingZip}
                className="flex-1 sm:flex-initial gap-1.5 text-xs h-9 px-3"
                title="Download selected photos as ZIP"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download ({selectedPhotoIds.length})</span>
              </Button>

              {(isOwner || !event.isGuest) && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsBatchDeleteModalOpen(true)}
                  disabled={selectedPhotoIds.length === 0}
                  className="flex-1 sm:flex-initial gap-1.5 text-xs h-9 px-3 bg-red-600 hover:bg-red-700 text-white"
                  title="Delete selected photos"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedPhotoIds.length})</span>
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitSelectionMode}
                className="text-xs h-9 px-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      <BatchDeleteModal
        isOpen={isBatchDeleteModalOpen}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        eventId={event.id}
        photoIds={selectedPhotoIds}
        isOwner={isOwner}
        onDeleted={(deletedIds) => {
          setPhotos((prev) => prev.filter((p) => !deletedIds.includes(p.id)));
          setSelectedPhotoIds([]);
          setIsSelectionMode(false);
          setTotalPhotosCount((c) => Math.max(0, c - deletedIds.length));
        }}
      />

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
