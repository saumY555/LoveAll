'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  FileImage,
  RefreshCw,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils';

export interface FileUploadItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface UploadDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  onUploadComplete?: () => void;
}

export function UploadDropzoneModal({
  isOpen,
  onClose,
  eventId,
  onUploadComplete,
}: UploadDropzoneModalProps) {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const validFiles: FileUploadItem[] = [];
    const maxBytes = 50 * 1024 * 1024;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        alert(`Skipped non-image file: ${file.name}`);
        return;
      }
      if (file.size > maxBytes) {
        alert(`Skipped ${file.name}: exceeds 50MB limit`);
        return;
      }
      validFiles.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        status: 'queued',
        progress: 0,
      });
    });

    setItems((prev) => [...prev, ...validFiles]);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Upload an individual item with XHR for accurate upload progress
  const uploadSingleItem = (item: FileUploadItem): Promise<boolean> => {
    return new Promise((resolve) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'uploading', progress: 10 } : i
        )
      );

      const formData = new FormData();
      formData.append('files', item.file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/events/${eventId}/photos/upload`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 90);
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    progress: percent,
                    status: percent >= 90 ? 'processing' : 'uploading',
                  }
                : i
            )
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.errors && data.errors.length > 0) {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id
                    ? { ...i, status: 'error', error: data.errors[0].reason }
                    : i
                )
              );
              resolve(false);
              return;
            }

            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id ? { ...i, status: 'done', progress: 100 } : i
              )
            );
            resolve(true);
          } catch {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? { ...i, status: 'error', error: 'Invalid response from server' }
                  : i
              )
            );
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
              i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i
            )
          );
          resolve(false);
        }
      };

      xhr.onerror = () => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', error: 'Network error during upload' }
              : i
          )
        );
        resolve(false);
      };

      xhr.send(formData);
    });
  };

  const handleStartUpload = async () => {
    const queuedItems = items.filter((i) => i.status === 'queued' || i.status === 'error');
    if (queuedItems.length === 0) return;

    setIsUploading(true);

    // Upload files in a parallel pool of 3 concurrent uploads for high throughput
    const CONCURRENCY = 3;
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
    if (onUploadComplete) {
      onUploadComplete();
    }
  };

  const completedCount = items.filter((i) => i.status === 'done').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const totalCount = items.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isUploading) onClose();
      }}
      title="Upload Photos to Shared Gallery"
      description="Add pictures to this event. High-resolution originals are preserved, and optimized previews are generated automatically."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
              : 'border-zinc-300 hover:border-zinc-400 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/50'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
            }}
            className="hidden"
          />

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400 mb-3">
            <Upload className="h-6 w-6" />
          </div>

          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Click to select photos or drag & drop here
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            JPEG, PNG, WebP, HEIC up to 50MB per file. Multi-file upload supported.
          </p>
        </div>

        {/* Selected Files List with per-file progress */}
        {items.length > 0 && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 max-h-64 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 gap-3">
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
                <div className="flex items-center gap-2">
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
                        onClick={() => uploadSingleItem(item)}
                        title="Retry"
                        className="text-xs text-indigo-600 hover:underline p-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {item.status === 'queued' && (
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={isUploading}
                      className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isUploading}
            >
              {completedCount > 0 && completedCount === totalCount ? 'Close' : 'Cancel'}
            </Button>

            {items.some((i) => i.status === 'queued' || i.status === 'error') && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartUpload}
                isLoading={isUploading}
                disabled={items.length === 0}
              >
                Upload {items.filter((i) => i.status === 'queued' || i.status === 'error').length} Photos
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
