'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Check, X, Loader2, Sparkles } from 'lucide-react';
import { EventWithRole } from '@/types';

interface PhotoItem {
  id: string;
  previewUrl: string;
  thumbnailUrl: string;
}

interface CoverPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventWithRole;
  currentCoverPhotoId: string | null;
  onSaveCover: (photoId: string, previewUrl: string) => Promise<void>;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function CoverPhotoPickerModal({
  isOpen,
  onClose,
  event,
  currentCoverPhotoId,
  onSaveCover,
  triggerRef,
}: CoverPhotoPickerModalProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(currentCoverPhotoId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize selected photo when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedPhotoId(currentCoverPhotoId);
      setError(null);
      setPage(1);
    }
  }, [isOpen, currentCoverPhotoId]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus trap and return focus on close
  useEffect(() => {
    if (!isOpen) {
      if (triggerRef?.current) {
        triggerRef.current.focus();
      }
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, triggerRef]);

  // Fetch photos for this event
  useEffect(() => {
    if (!isOpen || !event?.id) return;

    let ignore = false;
    async function fetchPhotos() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${event.id}/photos?page=${page}&limit=32`);
        const data = await res.json();
        if (!ignore) {
          if (res.ok) {
            setPhotos((prev) => (page === 1 ? data.photos : [...prev, ...data.photos]));
            setHasMore(data.pagination?.hasMore || false);
          } else {
            setError(data.error || 'Failed to load photos');
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError((err as Error).message || 'Failed to load photos');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchPhotos();
    return () => {
      ignore = true;
    };
  }, [isOpen, event?.id, page]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!selectedPhotoId || selectedPhotoId === currentCoverPhotoId) return;

    const chosen = photos.find((p) => p.id === selectedPhotoId);
    if (!chosen) return;

    setSaving(true);
    try {
      await onSaveCover(chosen.id, chosen.previewUrl);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save cover photo');
    } finally {
      setSaving(false);
    }
  };

  const isSaveDisabled =
    saving ||
    !selectedPhotoId ||
    selectedPhotoId === currentCoverPhotoId ||
    photos.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-picker-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(59, 43, 38, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          backgroundColor: 'var(--surface)',
          border: '2px solid var(--line)',
          borderRadius: '32px 32px 0 0',
          boxShadow: '0 -8px 24px rgba(59, 43, 38, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px clamp(16px, 4vw, 28px)',
          position: 'relative',
        }}
        className="cover-picker-sheet"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            borderBottom: '2px solid var(--line)',
            paddingBottom: '14px',
          }}
        >
          <div>
            <h2
              id="cover-picker-title"
              style={{
                fontFamily: 'var(--font-bricolage), Bricolage Grotesque, sans-serif',
                fontWeight: 800,
                fontSize: '1.45rem',
                margin: 0,
                color: 'var(--ink)',
              }}
            >
              Choose a cover photo
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-nunito), Nunito, sans-serif',
                fontSize: '0.85rem',
                color: 'var(--muted)',
                margin: '2px 0 0',
              }}
            >
              {photos.length} photo{photos.length === 1 ? '' : 's'} available in {event.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="icon-btn"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              border: '2px solid var(--line)',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              color: 'var(--ink)',
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '8px 14px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '2px solid var(--line)',
              borderRadius: '99px',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '14px',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Photos Grid Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingRight: '4px',
            marginRight: '-4px',
          }}
        >
          {loading && photos.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                gap: '8px',
                color: 'var(--muted)',
                fontFamily: 'var(--font-nunito), Nunito, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 700,
              }}
            >
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              <span>Loading photos...</span>
            </div>
          ) : photos.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '200px',
                padding: '24px',
                textAlign: 'center',
                background: 'var(--bg)',
                borderRadius: '20px',
                border: '2px dashed var(--line)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-bricolage), sans-serif',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  color: 'var(--ink)',
                  margin: '0 0 6px',
                }}
              >
                No photos yet
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-nunito), sans-serif',
                  fontSize: '0.85rem',
                  color: 'var(--muted)',
                  margin: 0,
                }}
              >
                Add photos to this event first to set a cover photo!
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                }}
                className="cover-picker-grid"
              >
                {photos.map((photo) => {
                  const isSelected = selectedPhotoId === photo.id;
                  const isCurrent = currentCoverPhotoId === photo.id;

                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setSelectedPhotoId(photo.id)}
                      aria-label={`Select photo as cover${isCurrent ? ' (current cover)' : ''}`}
                      aria-pressed={isSelected}
                      style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        border: isSelected
                          ? '3px solid var(--tomato)'
                          : '2px solid var(--line)',
                        boxShadow: isSelected ? '0 0 0 2px var(--tomato)' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        backgroundColor: 'var(--bg)',
                        transform: isSelected ? 'scale(0.97)' : 'none',
                        transition: 'transform 0.15s, border-color 0.15s',
                      }}
                    >
                      <Image
                        src={photo.thumbnailUrl}
                        alt="Event thumbnail"
                        fill
                        sizes="(max-width: 600px) 30vw, 120px"
                        style={{ objectFit: 'cover' }}
                        loading="lazy"
                      />

                      {/* Selected / Current Check Badge */}
                      {isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '6px',
                            right: '6px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--tomato)',
                            color: '#fff',
                            border: '1.5px solid var(--line)',
                            display: 'grid',
                            placeItems: 'center',
                            boxShadow: '1px 1px 0 var(--line)',
                          }}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      )}

                      {isCurrent && !isSelected && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '4px',
                            left: '4px',
                            right: '4px',
                            backgroundColor: 'rgba(59, 43, 38, 0.85)',
                            color: '#fff',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            borderRadius: '99px',
                            padding: '2px 6px',
                            textAlign: 'center',
                          }}
                        >
                          Current
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={loading}
                    className="btn sm"
                    style={{ background: 'var(--sun)' }}
                  >
                    {loading ? 'Loading...' : 'Load more photos'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            marginTop: '18px',
            paddingTop: '14px',
            borderTop: '2px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="btn white"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="btn go"
            style={{
              opacity: isSaveDisabled ? 0.6 : 1,
              cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving cover...' : 'Save cover'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 861px) {
          .cover-picker-sheet {
            border-radius: 32px !important;
            margin: auto !important;
            box-shadow: 8px 8px 0 var(--line) !important;
          }
          .cover-picker-grid {
            grid-template-columns: repeat(4, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
