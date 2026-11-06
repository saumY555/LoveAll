/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Sparkles,
  Mountain,
  Pencil,
  Loader2,
  Shield,
  User as UserIcon,
  RefreshCw,
  Check,
  X,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RenamePersonModal } from './RenamePersonModal';
import { PrivacyConsentModal } from '@/components/events/PrivacyConsentModal';

export interface DiscoveredPerson {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  photoCount: number;
  faceCount: number;
  isCover: boolean;
}

export interface FaceDiscoveryBarProps {
  eventId: string;
  selectedPersonIds?: string[];
  activePersonId?: string | null; // Backwards-compatible
  filterMode?: 'all' | 'any';
  onTogglePerson?: (personId: string) => void;
  onSelectPerson?: (personId: string | null) => void; // Backwards-compatible
  onClearPeople?: () => void;
  onSelectOtherPhotos?: () => void;
  onModeChange?: (mode: 'all' | 'any') => void;
  totalMatchCount?: number;
  onRefreshPhotos: () => void;
  canManage: boolean;
}

export function FaceDiscoveryBar({
  eventId,
  selectedPersonIds,
  activePersonId,
  filterMode = 'all',
  onTogglePerson,
  onSelectPerson,
  onClearPeople,
  onSelectOtherPhotos,
  onModeChange,
  totalMatchCount,
  onRefreshPhotos,
  canManage,
}: FaceDiscoveryBarProps) {
  const [people, setPeople] = useState<DiscoveredPerson[]>([]);
  const [otherPhotosCount, setOtherPhotosCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{
    done: number;
    total: number;
    pending: number;
    processing: number;
    failed: number;
  } | null>(null);

  const [renamingPerson, setRenamingPerson] = useState<DiscoveredPerson | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const effectiveSelectedIds = selectedPersonIds ?? (activePersonId ? [activePersonId] : []);
  const effectiveMode = filterMode ?? 'all';
  const selectedPeopleList = people.filter((p) => effectiveSelectedIds.includes(p.id));

  const labelText = (() => {
    if (effectiveSelectedIds.includes('none')) {
      return 'Landscapes & Other Photos';
    }
    if (selectedPeopleList.length === 0) {
      return 'All Photos';
    }
    if (selectedPeopleList.length === 1) {
      return `Photos with ${selectedPeopleList[0].name}`;
    }
    const names = selectedPeopleList.map((p) => p.name);
    const connector = effectiveMode === 'all' ? 'and' : 'or';
    if (names.length === 2) {
      return `Photos with ${names[0]} ${connector} ${names[1]}`;
    }
    return `Photos with ${names.slice(0, -1).join(', ')}, ${connector} ${names[names.length - 1]}`;
  })();

  const fetchPeople = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/people`);
      const data = await res.json();
      if (res.ok) {
        setPeople(data.people || []);
        setOtherPhotosCount(data.otherPhotosCount || 0);
      }
    } catch (err: unknown) {
      console.warn('Failed to load people:', err);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const pollScanStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/faces/status`);
      if (!res.ok) return;
      const data = await res.json();
      setScanProgress({
        done: data.done || 0,
        total: data.total || 0,
        pending: data.pending || 0,
        processing: data.processing || 0,
        failed: data.failed || 0,
      });

      if (data.isScanning) {
        setIsScanning(true);
        setScanMessage(`Processing ${data.done} of ${data.total} photos...`);
      } else if (isScanning) {
        // Was scanning, now complete
        setIsScanning(false);
        setScanMessage('Face processing complete!');
        await fetchPeople();
        onRefreshPhotos();
        setTimeout(() => setScanMessage(null), 5000);
      }
    } catch (err) {
      console.warn('Failed to poll face scan status:', err);
    }
  }, [eventId, isScanning, fetchPeople, onRefreshPhotos]);

  // Initial load: fetch people & initial face status
  useEffect(() => {
    let active = true;
    async function load() {
      await fetchPeople();
      if (active) {
        await pollScanStatus();
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [fetchPeople, pollScanStatus]);

  // Polling effect while scanning is active
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      pollScanStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isScanning, pollScanStatus]);

  const handleRunFaceScan = async (force = false) => {
    setIsScanning(true);
    setScanMessage(force ? 'Queueing forced rescan for all photos...' : 'Queueing face scan...');
    try {
      const res = await fetch(`/api/events/${eventId}/faces/scan${force ? '?force=true' : ''}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to queue face scan');

      setScanMessage(
        data.message || (force ? 'All photos queued for background scanning.' : 'New photos queued for background scanning.')
      );
      // Immediately poll to get latest counts and engage progress loop
      await pollScanStatus();
    } catch (err: unknown) {
      alert((err as Error).message);
      setIsScanning(false);
      setScanMessage(null);
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/80 shadow-xs mb-8 transition-all">
      {/* Top Header Row: Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Find by Person
              {people.length > 0 && (
                <Badge variant="purple" className="text-[10px] py-0 px-2">
                  {people.length} {people.length === 1 ? 'Person' : 'People'}
                </Badge>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {canManage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleRunFaceScan(e.shiftKey)}
                disabled={isScanning}
                title="Scan new photos (or Shift+Click to force rescan all photos)"
                className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-850 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Grouping Faces...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Group Faces
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRunFaceScan(true)}
                disabled={isScanning}
                title="Force re-scan all photos in this event from scratch"
                className="gap-1 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Force Rescan</span>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPrivacyModalOpen(true)}
            title="Face Privacy & Consent Settings"
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Privacy</span>
          </Button>
        </div>
      </div>

      {scanMessage && (
        <div className="mt-2.5 rounded-xl bg-indigo-50/80 p-2.5 text-xs text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 flex items-center justify-between border border-indigo-100 dark:border-indigo-900/40">
          <div className="flex items-center gap-2">
            {isScanning && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />}
            <span className="font-medium">{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-indigo-500 hover:text-indigo-700 text-xs cursor-pointer ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Multi-Person or Single-Person Filter Controls */}
      {selectedPeopleList.length >= 2 ? (
        <div className="mt-3 rounded-2xl bg-indigo-50/70 p-3 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2.5">
          {/* Top Row: Context Label & Mode Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {labelText}
              </span>
              {typeof totalMatchCount === 'number' && (
                <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                  {totalMatchCount === 0
                    ? '0 photos'
                    : totalMatchCount === 1
                    ? '1 photo'
                    : `${totalMatchCount} photos`}
                </span>
              )}
            </div>

            {/* Segmented Mode Toggle: Together vs. Either */}
            <div className="flex items-center gap-1 bg-white/90 dark:bg-zinc-900/90 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 self-start sm:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => onModeChange?.('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  effectiveMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title="Show photos where ALL selected people appear in the same photo"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Together</span>
              </button>

              <button
                type="button"
                onClick={() => onModeChange?.('any')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  effectiveMode === 'any'
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
                title="Show photos where ANY selected person appears"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Either</span>
              </button>

              <button
                type="button"
                onClick={() => onClearPeople ? onClearPeople() : onSelectPerson?.(null)}
                className="ml-1 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
                title="Clear selection"
              >
                <X className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Clear</span>
              </button>
            </div>
          </div>

          {/* Selected People Chips (large tap targets, clearly visible on mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 pt-0.5 scrollbar-thin">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold shrink-0">
              Selected:
            </span>
            {selectedPeopleList.map((person) => (
              <div
                key={person.id}
                className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-800/80 rounded-full pl-1 pr-2 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200 shadow-2xs shrink-0"
              >
                <div className="h-5 w-5 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0">
                  {person.thumbnailUrl ? (
                    <img src={person.thumbnailUrl} alt={person.name} className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-3 w-3 m-1 text-zinc-400" />
                  )}
                </div>
                <span className="truncate max-w-[100px]">{person.name}</span>
                <button
                  type="button"
                  onClick={() => onTogglePerson ? onTogglePerson(person.id) : onSelectPerson?.(null)}
                  className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded-full cursor-pointer transition-colors"
                  title={`Remove ${person.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Empty State Banner Hint if Together has 0 photos */}
          {totalMatchCount === 0 && effectiveMode === 'all' && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {selectedPeopleList.length === 2
                    ? 'No photos with both of them together.'
                    : 'No photos with all of them together.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onModeChange?.('any')}
                className="font-bold underline text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 cursor-pointer shrink-0"
              >
                Switch to Either →
              </button>
            </div>
          )}
        </div>
      ) : selectedPeopleList.length === 1 ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-indigo-50/60 p-2.5 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="h-6 w-6 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-700 shrink-0 border border-indigo-200">
              {selectedPeopleList[0].thumbnailUrl ? (
                <img src={selectedPeopleList[0].thumbnailUrl} alt={selectedPeopleList[0].name} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-3.5 w-3.5 m-1 text-zinc-400" />
              )}
            </div>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Photos with {selectedPeopleList[0].name}
            </span>
            {typeof totalMatchCount === 'number' && (
              <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300 bg-white/80 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                {totalMatchCount === 1 ? '1 photo' : `${totalMatchCount} photos`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClearPeople ? onClearPeople() : onSelectPerson?.(null)}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-white/60 dark:hover:bg-zinc-800/60"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      ) : effectiveSelectedIds.includes('none') ? (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl bg-zinc-100 p-2.5 dark:bg-zinc-800/60 text-xs">
          <div className="flex items-center gap-2">
            <Mountain className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              Landscapes & Other Photos (without detected faces)
            </span>
            {typeof totalMatchCount === 'number' && (
              <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                {totalMatchCount === 1 ? '1 photo' : `${totalMatchCount} photos`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onClearPeople ? onClearPeople() : onSelectPerson?.(null)}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      ) : null}

      {/* Horizontal Carousel of People Filter Chips */}
      <div className="mt-3.5 flex items-center gap-2.5 sm:gap-3 overflow-x-auto pb-2 scrollbar-none overscroll-x-contain touch-pan-x">
        {/* Everyone (All Photos) */}
        <button
          onClick={() => onClearPeople ? onClearPeople() : onSelectPerson?.(null)}
          className={`flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all shrink-0 cursor-pointer ${
            effectiveSelectedIds.length === 0
              ? 'bg-indigo-600 text-white shadow-xs font-semibold ring-2 ring-indigo-400/80 ring-offset-1 dark:ring-offset-zinc-900'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750'
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              effectiveSelectedIds.length === 0 ? 'bg-indigo-500/50 text-white' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
          </div>
          <span>Everyone</span>
        </button>

        {/* Loading state skeleton */}
        {isLoading ? (
          <div className="flex items-center gap-2 py-1 text-xs text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
            <span>Finding faces...</span>
          </div>
        ) : people.length === 0 ? (
          /* Zero people detected yet */
          <div className="flex items-center gap-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>No people grouped yet.</span>
            {canManage && (
              <button
                onClick={() => handleRunFaceScan(false)}
                disabled={isScanning}
                className="text-indigo-600 dark:text-indigo-400 underline font-medium cursor-pointer ml-1"
              >
                Scan photos now
              </button>
            )}
          </div>
        ) : (
          people.map((person) => {
            const isActive = effectiveSelectedIds.includes(person.id);
            return (
              <div
                key={person.id}
                className={`group relative flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5 text-xs transition-all shrink-0 cursor-pointer select-none ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold ring-2 ring-indigo-400/80 dark:ring-indigo-500/80 ring-offset-1 dark:ring-offset-zinc-900'
                    : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-750'
                }`}
                onClick={() => {
                  if (onTogglePerson) {
                    onTogglePerson(person.id);
                  } else if (onSelectPerson) {
                    onSelectPerson(isActive ? null : person.id);
                  }
                }}
              >
                {/* Person avatar with selection checkmark overlay */}
                <div className="relative h-7 w-7 overflow-hidden rounded-full border border-white/40 bg-zinc-200 dark:bg-zinc-700 shrink-0">
                  {person.thumbnailUrl ? (
                    <img
                      src={person.thumbnailUrl}
                      alt={person.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <UserIcon className="h-3.5 w-3.5" />
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-indigo-700/60 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                  )}
                </div>

                {/* Name */}
                <span className="truncate max-w-[120px]">{person.name}</span>

                {/* Photo Count */}
                <span
                  className={`text-[10px] rounded-full px-1.5 py-0.2 shrink-0 ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-zinc-200/70 text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-300'
                  }`}
                >
                  {person.photoCount}
                </span>

                {/* Rename Action Button */}
                {canManage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingPerson(person);
                    }}
                    title="Rename Person"
                    className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/10 dark:hover:bg-white/10 ${
                      isActive ? 'text-white' : 'text-zinc-500'
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Landscapes & Other Photos (photos without detected faces) */}
        {otherPhotosCount > 0 && (
          <button
            onClick={() => onSelectOtherPhotos ? onSelectOtherPhotos() : onSelectPerson?.('none')}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 cursor-pointer ${
              effectiveSelectedIds.includes('none')
                ? 'bg-indigo-600 text-white shadow-xs font-semibold ring-2 ring-indigo-400/80 ring-offset-1 dark:ring-offset-zinc-900'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-750'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>Other Photos</span>
            <span
              className={`text-[10px] rounded-full px-1.5 py-0.2 shrink-0 ${
                effectiveSelectedIds.includes('none')
                  ? 'bg-white/25 text-white'
                  : 'bg-zinc-200/70 text-zinc-600 dark:bg-zinc-700/80 dark:text-zinc-300'
              }`}
            >
              {otherPhotosCount}
            </span>
          </button>
        )}
      </div>

      {/* Rename Person Modal */}
      <RenamePersonModal
        isOpen={Boolean(renamingPerson)}
        onClose={() => setRenamingPerson(null)}
        eventId={eventId}
        person={renamingPerson}
        onRenamed={(personId, newName) => {
          setPeople((prev) =>
            prev.map((p) => (p.id === personId ? { ...p, name: newName } : p))
          );
        }}
      />

      {/* Privacy Consent Modal */}
      <PrivacyConsentModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        eventId={eventId}
        onConsentUpdated={() => {
          fetchPeople();
          onRefreshPhotos();
        }}
      />
    </div>
  );
}
