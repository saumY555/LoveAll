'use client';

import React, { useEffect, useState, useCallback, useMemo, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import '@/styles/gallery.css';

import { EventWithRole } from '@/types';
import { GalleryPhoto } from '@/components/photos/PhotoThumbnailCard';
import { DiscoveredPerson } from '@/components/photos/FaceDiscoveryBar';

import { GalleryHeader } from '@/components/gallery/GalleryHeader';
import { EventHeaderSection } from '@/components/gallery/EventHeaderSection';
import { FindByPersonCard, PERSON_COLORS } from '@/components/gallery/FindByPersonCard';
import { GalleryGridSection } from '@/components/gallery/GalleryGridSection';
import { GalleryMobileDock } from '@/components/gallery/GalleryMobileDock';

import { MemberManagerModal } from '@/components/events/MemberManagerModal';
import { EventSettingsModal } from '@/components/events/EventSettingsModal';
import { ShareModal } from '@/components/events/ShareModal';
import { UploadDropzoneModal } from '@/components/photos/UploadDropzoneModal';
import { PhotoLightboxModal } from '@/components/photos/PhotoLightboxModal';
import { PrivacyConsentModal } from '@/components/events/PrivacyConsentModal';
import { RenamePersonModal } from '@/components/photos/RenamePersonModal';
import { BatchDeleteModal } from '@/components/photos/BatchDeleteModal';

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const { data: session } = useSession();

  // Core Data State
  const [event, setEvent] = useState<EventWithRole | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  const [totalPhotosCount, setTotalPhotosCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPhotosLoading, setIsPhotosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection & Filter State
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'together' | 'either'>('together');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Background Face Scan State
  const [isScanning, setIsScanning] = useState(false);

  // Modals
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [renamingPerson, setRenamingPerson] = useState<DiscoveredPerson | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<GalleryPhoto | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // Compute People Meta Map for instant lookup in photo tiles
  const peopleMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; index: number; displayName: string; color: string; thumbnailUrl: string | null }
    >();
    people.forEach((p, idx) => {
      map.set(p.id, {
        id: p.id,
        index: idx + 1,
        displayName: p.name && p.name !== 'Unnamed Person' ? p.name : `Person ${idx + 1}`,
        color: PERSON_COLORS[idx % PERSON_COLORS.length],
        thumbnailUrl: p.thumbnailUrl,
      });
    });
    return map;
  }, [people]);

  // Fetch Event Details
  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load event details');
      }
      setEvent(data.event);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [eventId]);

  // Fetch Discovered People Clusters
  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/people`);
      const data = await res.json();
      if (res.ok) {
        setPeople(data.people || []);
      }
    } catch (err: unknown) {
      console.warn('Failed to load people:', err);
    }
  }, [eventId]);

  // Initial mount: load event and people once
  useEffect(() => {
    let ignore = false;
    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchEvent(), fetchPeople()]);
      } catch (err: unknown) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [eventId, fetchEvent, fetchPeople]);

  // Fetch Photos whenever selectedPersonIds or filterMode changes
  const fetchPhotos = useCallback(async () => {
    setIsPhotosLoading(true);
    try {
      const query = new URLSearchParams({ limit: '500' });
      if (selectedPersonIds.length > 0) {
        query.set('personIds', selectedPersonIds.join(','));
        if (selectedPersonIds.length > 1) {
          query.set('mode', filterMode === 'together' ? 'all' : 'any');
        }
      }
      const res = await fetch(`/api/events/${eventId}/photos?${query.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setPhotos(data.photos || []);
        if (selectedPersonIds.length === 0) {
          setTotalPhotosCount(data.pagination?.totalCount ?? data.photos?.length ?? 0);
        }
      }
    } catch (err: unknown) {
      console.warn('Failed to load photos:', err);
    } finally {
      setIsPhotosLoading(false);
    }
  }, [eventId, selectedPersonIds, filterMode]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Face Scan Polling
  const pollScanStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/faces/status`);
      if (!res.ok) return;
      const data = await res.json();

      if (data.isScanning) {
        setIsScanning(true);
      } else if (isScanning) {
        setIsScanning(false);
        await Promise.all([fetchPeople(), fetchPhotos()]);
      }
    } catch {
      // Ignored
    }
  }, [eventId, isScanning, fetchPeople, fetchPhotos]);

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(pollScanStatus, 3000);
    return () => clearInterval(interval);
  }, [isScanning, pollScanStatus]);

  // Trigger Face Scan
  const handleRunFaceScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/events/${eventId}/faces/scan`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue face scan');
      await pollScanStatus();
    } catch (err: unknown) {
      alert((err as Error).message);
      setIsScanning(false);
    }
  };

  // Toggle Person Filter
  const handleTogglePerson = (personId: string) => {
    setSelectedPersonIds((prev) =>
      prev.includes(personId) ? prev.filter((id) => id !== personId) : [...prev, personId]
    );
  };

  const handleClearSelection = () => {
    setSelectedPersonIds([]);
  };

  // Toggle Photo Select in Selection Mode
  const handleToggleSelectPhoto = (photoId: string) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(photoId) ? prev.filter((id) => id !== photoId) : [...prev, photoId]
    );
  };

  // Trigger ZIP Download
  const handleDownloadZip = async (specificPhotoIds?: string[]) => {
    setIsDownloadingZip(true);
    try {
      const query = new URLSearchParams();
      if (specificPhotoIds && specificPhotoIds.length > 0) {
        query.set('photoIds', specificPhotoIds.join(','));
      } else if (selectedPersonIds.length > 0) {
        query.set('personIds', selectedPersonIds.join(','));
        if (selectedPersonIds.length > 1) {
          query.set('mode', filterMode === 'together' ? 'all' : 'any');
        }
      }

      const queryString = query.toString();
      const downloadUrl = `/api/events/${eventId}/photos/download${queryString ? `?${queryString}` : ''}`;

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

  if (isLoading) {
    return (
      <div className="loveall-gallery">
        <div className="wrap">
          <GalleryHeader />
          <div style={{ textAlign: 'center', padding: '100px 0', fontWeight: 800 }}>
            Loading gallery…
          </div>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="loveall-gallery">
        <div className="wrap">
          <GalleryHeader />
          <div className="none" style={{ display: 'block', margin: '60px auto' }}>
            <h3>Couldn’t load this gallery. Try again.</h3>
            <p style={{ marginTop: '8px' }}>{error || 'Event not found or access restricted.'}</p>
            <button
              type="button"
              className="btn sm"
              style={{ marginTop: '16px', background: '#fff' }}
              onClick={() => {
                fetchEvent();
                fetchPeople();
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = event.userRole === 'OWNER';
  const canUpload =
    !!event.userRole || (event.isGuest ? !!event.canGuestUpload : event.allowGuestUpload);

  return (
    <div className="loveall-gallery">
      <div className="wrap">
        {/* Navigation Header */}
        <GalleryHeader />

        <main>
          {/* Event Head Section */}
          <EventHeaderSection
            event={event}
            photoCount={photos.length}
            peopleCount={people.length}
            isOwner={isOwner}
            canUpload={canUpload}
            onOpenMembers={() => setIsMemberModalOpen(true)}
            onOpenShare={() => setIsShareModalOpen(true)}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenUpload={() => setIsUploadModalOpen(true)}
          />

          {/* Find by Person Card */}
          <FindByPersonCard
            people={people}
            selectedPersonIds={selectedPersonIds}
            filterMode={filterMode}
            onTogglePerson={handleTogglePerson}
            onClearSelection={handleClearSelection}
            onModeChange={setFilterMode}
            matchingCount={photos.length}
            totalPhotosCount={totalPhotosCount}
            isScanning={isScanning}
            onGroupFaces={handleRunFaceScan}
            onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
            onRenamePerson={(p) => setRenamingPerson(p)}
          />

          {/* Gallery Grid Section */}
          <GalleryGridSection
            photos={photos}
            totalPhotosCount={totalPhotosCount}
            peopleMap={peopleMap}
            isFilterActive={selectedPersonIds.length > 0}
            filterMode={filterMode}
            isSelectionMode={isSelectionMode}
            selectedPhotoIds={selectedPhotoIds}
            isDownloadingZip={isDownloadingZip}
            isPhotosLoading={isPhotosLoading}
            onToggleSelectionMode={() => {
              if (isSelectionMode) {
                setIsSelectionMode(false);
                setSelectedPhotoIds([]);
              } else {
                setIsSelectionMode(true);
              }
            }}
            onToggleSelectPhoto={handleToggleSelectPhoto}
            onDownloadZip={() => {
              if (isSelectionMode && selectedPhotoIds.length > 0) {
                handleDownloadZip(selectedPhotoIds);
              } else {
                handleDownloadZip();
              }
            }}
            onPhotoClick={(p) => setLightboxPhoto(p)}
          />
        </main>
      </div>

      {/* Mobile Floating Action Dock (phones only) */}
      <GalleryMobileDock
        canUpload={canUpload}
        onUploadPhotos={() => setIsUploadModalOpen(true)}
        onDownloadAll={() => handleDownloadZip()}
        isDownloading={isDownloadingZip}
      />

      {/* Modals */}
      <UploadDropzoneModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        eventId={event.id}
        onUploadComplete={() => {
          fetchPhotos();
          fetchPeople();
        }}
      />

      <PhotoLightboxModal
        photos={photos}
        currentPhoto={lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={(nextPhoto) => setLightboxPhoto(nextPhoto)}
      />

      <MemberManagerModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        eventId={event.id}
        isOwner={isOwner}
        currentUserId={session?.user?.id}
        initialMembers={event.members || []}
        onMembersUpdated={() => {
          fetchEvent();
        }}
      />

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

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        eventId={event.id}
        eventName={event.name}
        isOwner={isOwner}
      />

      <PrivacyConsentModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        eventId={event.id}
        onConsentUpdated={() => {
          fetchPeople();
          fetchPhotos();
        }}
      />

      <RenamePersonModal
        isOpen={Boolean(renamingPerson)}
        onClose={() => setRenamingPerson(null)}
        eventId={event.id}
        person={renamingPerson}
        onRenamed={(personId, newName) => {
          setPeople((prev) =>
            prev.map((p) => (p.id === personId ? { ...p, name: newName } : p))
          );
        }}
      />

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
    </div>
  );
}
