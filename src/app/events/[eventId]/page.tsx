'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
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
import { UploadDropzoneModal, UploadProgressInfo } from '@/components/photos/UploadDropzoneModal';
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
  const isScanningRef = useRef(false);
  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  // Live Background Upload State
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo>({
    isUploading: false,
    totalCount: 0,
    completedCount: 0,
    errorCount: 0,
    progressPercent: 0,
  });

  // Short Confirmation Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  }, []);

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
    // 1. Count occurrences of each custom name's first letter
    const letterCounts = new Map<string, number>();
    people.forEach((p) => {
      const hasCustomName = Boolean(p.name && p.name !== 'Unnamed Person' && !p.name.startsWith('Person '));
      if (hasCustomName) {
        const firstChar = p.name!.trim()[0].toUpperCase();
        letterCounts.set(firstChar, (letterCounts.get(firstChar) || 0) + 1);
      }
    });

    // 2. Build the map with dotLabel
    const map = new Map<
      string,
      { id: string; index: number; displayName: string; color: string; dotLabel: string; thumbnailUrl: string | null }
    >();

    people.forEach((p, idx) => {
      const index = idx + 1;
      const hasCustomName = Boolean(p.name && p.name !== 'Unnamed Person' && !p.name.startsWith('Person '));
      const displayName = hasCustomName ? p.name!.trim() : `Person ${index}`;

      let dotLabel = String(index);
      if (hasCustomName) {
        const firstChar = displayName[0].toUpperCase();
        // If unique first letter, use it; if shared by 2+ people, use the number
        if ((letterCounts.get(firstChar) || 0) === 1) {
          dotLabel = firstChar;
        }
      }

      map.set(p.id, {
        id: p.id,
        index,
        displayName,
        color: PERSON_COLORS[idx % PERSON_COLORS.length],
        dotLabel,
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

  // Initial mount: load event, people, and auto-check face scan status
  useEffect(() => {
    let ignore = false;
    async function init() {
      setIsLoading(true);
      setError(null);
      try {
        await Promise.all([fetchEvent(), fetchPeople()]);
        // Auto-check face scanning status
        const statusRes = await fetch(`/api/events/${eventId}/faces/status`);
        if (!ignore && statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.isScanning || statusData.pending > 0 || statusData.processing > 0) {
            setIsScanning(true);
          }
        }
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

      if (data.isScanning || data.pending > 0 || data.processing > 0) {
        setIsScanning(true);
        // Live update people and photos during active scan so newly grouped faces appear in real-time
        await Promise.all([fetchPeople(), fetchPhotos()]);
      } else if (isScanningRef.current) {
        setIsScanning(false);
        await Promise.all([fetchPeople(), fetchPhotos()]);
      }
    } catch {
      // Ignored
    }
  }, [eventId, fetchPeople, fetchPhotos]);

  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(pollScanStatus, 2500);
    return () => clearInterval(interval);
  }, [isScanning, pollScanStatus]);

  // Trigger Face Scan
  const handleRunFaceScan = useCallback(
    async (showAlert = true) => {
      setIsScanning(true);
      try {
        const res = await fetch(`/api/events/${eventId}/faces/scan`, {
          method: 'POST',
        });
        const data = await res.json();
        if (!res.ok) {
          if (showAlert) alert(data.error || 'Failed to queue face scan');
          setIsScanning(false);
          return;
        }
        await pollScanStatus();
      } catch (err: unknown) {
        if (showAlert) alert((err as Error).message);
        setIsScanning(false);
      }
    },
    [eventId, pollScanStatus]
  );

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

  const isAllPhotosSelected = photos.length > 0 && selectedPhotoIds.length === photos.length;

  const handleSelectAllPhotos = useCallback(() => {
    setSelectedPhotoIds(photos.map((p) => p.id));
  }, [photos]);

  const handleDeselectAllPhotos = useCallback(() => {
    setSelectedPhotoIds([]);
  }, []);

  const handleOpenBatchDelete = useCallback(() => {
    if (selectedPhotoIds.length > 0) {
      setIsBatchDeleteModalOpen(true);
    }
  }, [selectedPhotoIds.length]);

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
            onSelectAll={handleSelectAllPhotos}
            onDeselectAll={handleDeselectAllPhotos}
            onDownloadZip={() => {
              if (isSelectionMode && selectedPhotoIds.length > 0) {
                handleDownloadZip(selectedPhotoIds);
              } else {
                handleDownloadZip();
              }
            }}
            onDeleteSelected={handleOpenBatchDelete}
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
        isSelectionMode={isSelectionMode}
        selectedCount={selectedPhotoIds.length}
        isAllSelected={isAllPhotosSelected}
        onSelectAll={handleSelectAllPhotos}
        onDeselectAll={handleDeselectAllPhotos}
        onDownloadSelected={() => handleDownloadZip(selectedPhotoIds)}
        onDeleteSelected={handleOpenBatchDelete}
        onExitSelectionMode={() => {
          setIsSelectionMode(false);
          setSelectedPhotoIds([]);
        }}
      />

      {/* Modals */}
      <UploadDropzoneModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        eventId={event.id}
        onUploadProgress={(progress) => {
          setUploadProgress(progress);
          // If upload is actively running and at least 1 photo has uploaded, start live face scanning!
          if (progress.isUploading && progress.completedCount > 0 && !isScanningRef.current) {
            setIsScanning(true);
          }
        }}
        onPhotoUploaded={() => {
          fetchPhotos();
          fetchPeople();
          if (!isScanningRef.current) {
            setIsScanning(true);
          }
        }}
        onUploadComplete={() => {
          setUploadProgress({
            isUploading: false,
            totalCount: 0,
            completedCount: 0,
            errorCount: 0,
            progressPercent: 0,
          });
          fetchPhotos();
          fetchPeople();
          showToast(`✓ Upload complete! Grouping faces in background…`);
          handleRunFaceScan(false);
        }}
      />

      {/* Floating Background Upload Card (visible ONLY while uploads are actively in progress) */}
      {uploadProgress.isUploading &&
        uploadProgress.totalCount > 0 &&
        uploadProgress.completedCount + uploadProgress.errorCount < uploadProgress.totalCount &&
        !isUploadModalOpen && (
          <aside
            className="bg-upload-card"
            role="status"
            aria-live="polite"
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--tomato)',
                border: '2px solid var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Uploading {uploadProgress.completedCount} of {uploadProgress.totalCount}…
              </div>
              <div
                style={{
                  width: '100%',
                  height: '7px',
                  background: '#EAE1D9',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  marginTop: '5px',
                  border: '1.5px solid var(--ink)',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: 'var(--mint)',
                    width: `${uploadProgress.progressPercent}%`,
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <button
                type="button"
                className="btn sm"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  background: '#fff',
                }}
                onClick={() => setIsUploadModalOpen(true)}
              >
                View
              </button>
              <button
                type="button"
                className="btn sm"
                style={{
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  background: '#fff',
                }}
                onClick={() => {
                  setUploadProgress({
                    isUploading: false,
                    totalCount: 0,
                    completedCount: 0,
                    errorCount: 0,
                    progressPercent: 0,
                  });
                }}
                aria-label="Dismiss upload bar"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </aside>
        )}

      {/* Floating Confirmation Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--mint)',
            color: 'var(--on)',
            border: '2px solid var(--ink)',
            boxShadow: '4px 4px 0 var(--ink)',
            borderRadius: '999px',
            padding: '10px 22px',
            fontWeight: 800,
            fontSize: '0.92rem',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          <span>{toastMessage}</span>
        </div>
      )}

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
          showToast(`Deleted ${deletedIds.length} photo${deletedIds.length === 1 ? '' : 's'}`);
        }}
      />
    </div>
  );
}
