/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Share2,
  Copy,
  Check,
  QrCode as QrIcon,
  Download,
  UploadCloud,
  Eye,
  Loader2,
  Ban,
} from 'lucide-react';

interface ShareLinkItem {
  id: string;
  token: string;
  canView: boolean;
  canUpload: boolean;
  isRevoked: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
}

export function ShareModal({
  isOpen,
  onClose,
  eventId,
  eventName,
}: ShareModalProps) {
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // New link options
  const [canView, setCanView] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(7);

  // Generated link details
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFullShareUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${token}`;
    }
    return `/share/${token}`;
  };

  // Fetch existing share links when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function fetchLinks() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/events/${eventId}/share-links`);
        const data = await res.json();
        if (!ignore && res.ok) {
          const fetchedLinks = data.shareLinks || [];
          setLinks(fetchedLinks);
          const firstActive = fetchedLinks.find((l: ShareLinkItem) => !l.isRevoked);
          if (firstActive) {
            setLatestToken(firstActive.token);
          }
        }
      } catch (err: unknown) {
        if (!ignore) setError((err as Error).message);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchLinks();
    return () => {
      ignore = true;
    };
  }, [isOpen, eventId]);

  // Generate QR code whenever active token changes
  useEffect(() => {
    if (!latestToken) {
      return;
    }

    let active = true;
    const shareUrl = getFullShareUrl(latestToken);
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('Failed to generate QR:', err));

    return () => {
      active = false;
    };
  }, [latestToken]);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canView,
          canUpload,
          expiresInDays: expiresInDays ? Number(expiresInDays) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate share link');

      setLinks((prev) => [data.shareLink, ...prev]);
      setLatestToken(data.shareLink.token);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    if (!confirm('Are you sure you want to revoke this link? Attendees using it will lose guest access immediately.')) {
      return;
    }

    setRevokingId(linkId);
    try {
      const res = await fetch(`/api/events/${eventId}/share-links/${linkId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke link');

      setLinks((prev) =>
        prev.map((l) => (l.id === linkId ? { ...l, isRevoked: true } : l))
      );
      if (latestToken && links.find((l) => l.id === linkId)?.token === latestToken) {
        const nextActive = links.find((l) => l.id !== linkId && !l.isRevoked);
        setLatestToken(nextActive ? nextActive.token : null);
        if (!nextActive) setQrDataUrl(null);
      }
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = () => {
    if (!latestToken) return;
    const url = getFullShareUrl(latestToken);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `event-qr-${eventName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Share Event & Invite Guests"
      description="Create tokenized links and printable QR codes so attendees can view and contribute photos without creating an account."
      maxWidth="xl"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Top Active QR & Link Card (if any active link exists) */}
        {latestToken ? (
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 p-5 dark:border-indigo-950/60 dark:from-indigo-950/20 dark:via-zinc-900 dark:to-purple-950/20 shadow-xs">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* QR Code Canvas/Image */}
              <div className="flex flex-col items-center gap-2">
                <div className="p-2.5 bg-white rounded-xl shadow-xs border border-zinc-200 dark:border-zinc-700">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Event QR Code"
                      className="h-36 w-36 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="h-36 w-36 flex items-center justify-center text-zinc-400">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadQr}
                  className="gap-1.5 text-xs h-7 px-2.5 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save QR Image
                </Button>
              </div>

              {/* Link Details and Copy Button */}
              <div className="flex-1 w-full space-y-3 text-left">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Active Guest Link
                  </span>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    Attendees who scan this QR code or click this link can view the gallery and upload their photos.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getFullShareUrl(latestToken)}
                    className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-mono text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 focus:outline-none select-all"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCopy}
                    className="gap-1.5 shrink-0 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </Button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-emerald-600" /> Guest View Enabled
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <UploadCloud className="w-3.5 h-3.5 text-indigo-600" /> Guest Uploads Enabled
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          !isLoading && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30">
              <QrIcon className="w-8 h-8 mx-auto text-zinc-400 mb-2" />
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                No active share links yet
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Generate a link below to invite attendees with a QR code or shareable URL.
              </p>
            </div>
          )
        )}

        {/* Create New Link Section */}
        <form
          onSubmit={handleCreateLink}
          className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Create New Share Link
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* View Capability */}
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={canView}
                onChange={(e) => setCanView(e.target.checked)}
                className="h-4 w-4 rounded-sm text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Allow Viewing</span>
                <span className="text-[10px] text-zinc-500">Browse photos</span>
              </div>
            </label>

            {/* Upload Capability */}
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={canUpload}
                onChange={(e) => setCanUpload(e.target.checked)}
                className="h-4 w-4 rounded-sm text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <span className="font-medium text-zinc-900 dark:text-zinc-100 block">Allow Uploads</span>
                <span className="text-[10px] text-zinc-500">Guests contribute</span>
              </div>
            </label>

            {/* Expiration Dropdown */}
            <div className="p-2.5 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 flex flex-col justify-center">
              <label className="text-[10px] font-medium text-zinc-500 mb-1 block">Link Expiry</label>
              <select
                value={expiresInDays === null ? 'never' : String(expiresInDays)}
                onChange={(e) =>
                  setExpiresInDays(e.target.value === 'never' ? null : Number(e.target.value))
                }
                className="h-7 w-full rounded border border-zinc-300 bg-white px-2 text-xs text-zinc-800 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="1">24 Hours</option>
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="never">Never Expires</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              variant="primary"
              isLoading={isCreating}
              className="gap-1.5 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Generate Link & QR Code
            </Button>
          </div>
        </form>

        {/* Existing Links List & Revocation */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            All Share Links ({links.length})
          </h4>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-xs text-zinc-400 py-2">No links created yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-48 overflow-y-auto">
              {links.map((link) => {
                const isExpired = link.expiresAt && new Date() > new Date(link.expiresAt);
                const isActive = !link.isRevoked && !isExpired;

                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          if (isActive) setLatestToken(link.token);
                        }}
                        className="text-xs font-mono text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 truncate max-w-[140px] sm:max-w-xs cursor-pointer text-left"
                        title="Click to view QR code"
                      >
                        {link.token}
                      </button>

                      {link.isRevoked ? (
                        <Badge variant="danger">Revoked</Badge>
                      ) : isExpired ? (
                        <Badge variant="default">Expired</Badge>
                      ) : (
                        <Badge variant="success">
                          {link.canUpload ? 'View & Upload' : 'View Only'}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(getFullShareUrl(link.token));
                              alert('Link copied to clipboard!');
                            }}
                            className="h-7 px-2 text-xs"
                            title="Copy link"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={revokingId === link.id}
                            onClick={() => handleRevoke(link.id)}
                            className="h-7 px-2 text-xs gap-1"
                            title="Revoke link immediately"
                          >
                            <Ban className="w-3 h-3" />
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
