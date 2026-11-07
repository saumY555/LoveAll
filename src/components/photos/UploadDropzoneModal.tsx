'use client';

import React, { useState, useRef, useCallback, memo, useTransition } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileImage,
  RefreshCw,
  Trash2,
  Zap,
  Image as ImageIcon,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';
import { compressImageClientSide } from '@/lib/clientImageCompression';

export interface FileUploadItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
}

export interface UploadProgressInfo {
  isUploading: boolean;
  totalCount: number;
  completedCount: number;
  errorCount: number;
  progressPercent: number;
}

interface UploadDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onUploadComplete?: () => void;
  onPhotoUploaded?: () => void;
  onUploadProgress?: (progress: UploadProgressInfo) => void;
}

interface UploadItemRowProps {
  item: FileUploadItem;
  isUploading: boolean;
  onRetry: (item: FileUploadItem) => void;
  onRemove: (id: string) => void;
}

// Memoized item row with CSS content-visibility for silky smooth 60fps rendering even with 100+ files
const UploadItemRow = memo(function UploadItemRow({
  item,
  isUploading,
  onRetry,
  onRemove,
}: UploadItemRowProps) {
  return (
    <div
      className="flex items-center justify-between p-3 gap-3 transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 48px' }}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
          <FileImage className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {item.file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-zinc-500">
              {formatBytes(item.file.size)}
            </span>
            {item.status === 'processing' && (
              <span className="text-[11px] text-indigo-600 font-medium animate-pulse">
                Generating WebP preview...
              </span>
            )}
            {item.status === 'error' && (
              <span className="text-[11px] text-red-600 font-medium truncate">
                {item.error || 'Failed'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Indicator / Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {item.status === 'uploading' && (
          <div className="w-16 bg-zinc-200 rounded-full h-1.5 dark:bg-zinc-700">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
              style={{ width: `${item.progress}%` }}
            />
          </div>
        )}

        {item.status === 'done' && (
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        )}

        {item.status === 'error' && (
          <div className="flex items-center gap-1">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <button
              onClick={() => onRetry(item)}
              title="Retry"
              className="text-xs text-indigo-600 hover:underline p-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {item.status === 'queued' && (
          <button
            onClick={() => onRemove(item.id)}
            disabled={isUploading}
            aria-label={`Remove ${item.file.name}`}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
});

export function UploadDropzoneModal({
  isOpen,
  onClose,
  eventId,
  onUploadComplete,
  onPhotoUploaded,
  onUploadProgress,
}: UploadDropzoneModalProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [qualityMode, setQualityMode] = useState<'original' | 'compressed'>('original');
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const completedRef = useRef(0);
  const errorRef = useRef(0);
  const totalRef = useRef(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const addFiles = useCallback((files: FileList | File[]) => {
    const validFiles: FileUploadItem[] = [];
    const skippedReasons: string[] = [];
    const maxBytes = 50 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        skippedReasons.push(`${file.name} (not an image)`);
        return;
      }
      if (file.size > maxBytes) {
        skippedReasons.push(`${file.name} (>50MB)`);
        return;
      }
      validFiles.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        status: 'queued',
        progress: 0,
      });
    });

    if (skippedReasons.length > 0) {
      setWarningMessage(
        `Skipped ${skippedReasons.length} unsupported file(s): ${skippedReasons.slice(0, 3).join(', ')}${
          skippedReasons.length > 3 ? '...' : ''
        }`
      );
    } else {
      setWarningMessage(null);
    }

    if (validFiles.length > 0) {
      startTransition(() => {
        setItems((prev) => [...prev, ...validFiles]);
      });
    }
  }, []);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeItem = useCallback((id: string) => {
    startTransition(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    });
  }, []);

  const clearAllQueued = useCallback(() => {
    startTransition(() => {
      setItems((prev) => prev.filter((item) => item.status !== 'queued' && item.status !== 'error'));
    });
  }, []);

  const reportProgressLive = useCallback(() => {
    if (!onUploadProgress) return;
    const total = totalRef.current;
    const completed = completedRef.current;
    const errors = errorRef.current;
    const isFinished = total > 0 && completed + errors >= total;
    const pct = total > 0 ? Math.min(100, Math.round(((completed + errors) / total) * 100)) : 0;
    onUploadProgress({
      isUploading: !isFinished,
      totalCount: total,
      completedCount: completed,
      errorCount: errors,
      progressPercent: isFinished ? 100 : pct,
    });
  }, [onUploadProgress]);

  // Upload an individual item with throttled XHR progress updates and client-side compression
  const uploadSingleItem = useCallback(
    async (item: FileUploadItem): Promise<boolean> => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'uploading', progress: 10 } : i
        )
      );

      let fileToUpload = item.file;
      if (qualityMode === 'compressed') {
        try {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'processing', progress: 15 } : i
            )
          );
          fileToUpload = await compressImageClientSide(item.file);
        } catch (err) {
          console.warn('Compression fallback to original:', err);
        }
      }

      return new Promise((resolve) => {
        const formData = new FormData();
        formData.append('files', fileToUpload);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/events/${eventId}/photos/upload`);

        let lastReportedProgress = 15;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.min(89, Math.round((e.loaded / e.total) * 90));
            // Throttle state dispatches: update only on meaningful progress jumps (>= 5%)
            if (percent - lastReportedProgress >= 5 || percent >= 88) {
              lastReportedProgress = percent;
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? {
                        ...i,
                        progress: percent,
                        status: percent >= 88 ? 'processing' : 'uploading',
                      }
                    : i
                )
              );
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.errors && data.errors.length > 0) {
                const errReason = data.errors[0].reason || 'Upload failed';
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === item.id
                      ? { ...i, status: 'error' as const, error: errReason }
                      : i
                  )
                );
                errorRef.current += 1;
                reportProgressLive();
                resolve(false);
                return;
              }

              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id ? { ...i, status: 'done' as const, progress: 100 } : i
                )
              );
              completedRef.current += 1;
              reportProgressLive();
              onPhotoUploaded?.();
              resolve(true);
            } catch {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? { ...i, status: 'error' as const, error: 'Invalid response from server' }
                    : i
                )
              );
              errorRef.current += 1;
              reportProgressLive();
              resolve(false);
            }
          } else {
            let errorMsg = 'Upload failed';
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.error) errorMsg = data.error;
            } catch {
              // fallback
            }
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, status: 'error' as const, error: errorMsg } : i
              )
            );
            errorRef.current += 1;
            reportProgressLive();
            resolve(false);
          }
        };

        xhr.onerror = () => {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error' as const, error: 'Network error during upload' }
                : i
            )
          );
          errorRef.current += 1;
          reportProgressLive();
          resolve(false);
        };

        xhr.send(formData);
      });
    },
    [eventId, qualityMode, onPhotoUploaded, reportProgressLive]
  );

  const handleStartUpload = async () => {
    const queuedItems = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (queuedItems.length === 0) return;

    totalRef.current = items.length;
    completedRef.current = items.filter((i) => i.status === 'done').length;
    errorRef.current = 0;

    setIsUploading(true);
    reportProgressLive();

    // In compressed mode, payloads are 80-90% smaller so concurrency can safely be 4 for high speed
    const CONCURRENCY = qualityMode === 'compressed' ? 4 : 3;
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < queuedItems.length) {
        const currentIndex = nextIndex++;
        const item = queuedItems[currentIndex];
        if (item) {
          await uploadSingleItem(item);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, queuedItems.length) },
      () => worker()
    );

    await Promise.all(workers);

    setIsUploading(false);
    reportProgressLive();

    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const completedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const queuedCount = items.filter((i) => i.status === 'queued' || i.status === 'error').length;
  const totalCount = items.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Photos to Shared Gallery"
      description="Add pictures to this event. High-resolution originals are preserved, and optimized previews are generated automatically."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Warning notification banner if files were skipped */}
        {warningMessage && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 p-3 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{warningMessage}</span>
            </div>
            <button
              onClick={() => setWarningMessage(null)}
              className="text-amber-600 hover:text-amber-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Hidden native file input triggered programmatically to avoid click hijacking */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          tabIndex={-1}
        />

        {/* Upload Quality Selector (Original vs Compressed WhatsApp-style) */}
        <div
          style={{
            background: '#FFF8F0',
            border: '2px solid var(--ink, #3B2B26)',
            borderRadius: '20px',
            boxShadow: '3px 3px 0 var(--ink, #3B2B26)',
            padding: '12px 14px',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: 'var(--ink, #3B2B26)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Upload quality</span>
            </span>

            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: qualityMode === 'compressed' ? '#007A50' : '#7A5C54',
                background: qualityMode === 'compressed' ? 'var(--mint, #6FD9B0)' : '#EFEAE4',
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1.5px solid var(--ink, #3B2B26)',
              }}
            >
              {qualityMode === 'compressed' ? '⚡ 5x-10x Faster' : 'Original Quality'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Option 1: Original */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setQualityMode('original')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '14px',
                border: '2px solid var(--ink, #3B2B26)',
                background: qualityMode === 'original' ? 'var(--lilac, #C5B4FF)' : '#FFFFFF',
                boxShadow: qualityMode === 'original' ? '2px 2px 0 var(--ink, #3B2B26)' : 'none',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  border: '1.5px solid var(--ink, #3B2B26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ImageIcon className="w-3.5 h-3.5 text-stone-700" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink, #3B2B26)' }}>
                  Original (Default)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#55423C', lineHeight: 1.2 }}>
                  Full camera resolution
                </div>
              </div>
            </button>

            {/* Option 2: Compressed (WhatsApp style) */}
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setQualityMode('compressed')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '14px',
                border: '2px solid var(--ink, #3B2B26)',
                background: qualityMode === 'compressed' ? 'var(--mint, #6FD9B0)' : '#FFFFFF',
                boxShadow: qualityMode === 'compressed' ? '2px 2px 0 var(--ink, #3B2B26)' : 'none',
                cursor: isUploading ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  border: '1.5px solid var(--ink, #3B2B26)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--ink, #3B2B26)' }}>
                  Compressed (Fast)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#55423C', lineHeight: 1.2 }}>
                  WhatsApp style • uses less data
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Drag and Drop Zone button with cute playful styling */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
            isDragging
              ? 'border-pink-500 bg-pink-50/80 dark:bg-pink-950/40 scale-[1.01]'
              : 'border-purple-200 hover:border-purple-400 bg-gradient-to-br from-pink-50/30 via-purple-50/20 to-amber-50/20 dark:border-purple-900/60 dark:bg-stone-850 hover:bg-purple-50/40'
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 text-white shadow-md shadow-pink-500/20 mb-3 mx-auto pointer-events-none select-none animate-float">
            <Upload className="h-7 w-7" />
          </div>

          <p className="text-sm font-bold text-stone-900 dark:text-stone-100 pointer-events-none select-none flex items-center justify-center gap-1.5">
            <span>Click to select photos or drag & drop here</span>
            <span className="text-pink-500">✨</span>
          </p>
          <p className="mt-1 text-xs text-stone-500 pointer-events-none select-none font-medium">
            JPEG, PNG, WebP, HEIC up to 50MB. High-res originals preserved safely.
          </p>
        </div>

        {/* Selected Files Header & List */}
        {items.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {queuedCount > 0 ? `${queuedCount} photo(s) selected` : `${items.length} photo(s) processed`}
              </span>
              {!isUploading && queuedCount > 0 && (
                <button
                  onClick={clearAllQueued}
                  className="inline-flex items-center gap-1 text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer text-xs font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All ({queuedCount})</span>
                </button>
              )}
            </div>

            {/* Scrollable list with content-visibility for instant 60fps rendering */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <UploadItemRow
                  key={item.id}
                  item={item}
                  isUploading={isUploading}
                  onRetry={uploadSingleItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="text-xs text-zinc-500">
            {totalCount > 0 ? (
              <span>
                {completedCount} of {totalCount} uploaded
                {errorCount > 0 && ` (${errorCount} failed)`}
              </span>
            ) : (
              <span>No photos selected</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isUploading ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Upload in background
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                {completedCount > 0 && completedCount === totalCount ? 'Close' : 'Cancel'}
              </Button>
            )}

            {queuedCount > 0 && !isUploading && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartUpload}
                disabled={items.length === 0}
              >
                Upload {queuedCount} Photo{queuedCount === 1 ? '' : 's'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
