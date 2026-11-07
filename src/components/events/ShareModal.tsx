'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';

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
  isOwner?: boolean;
}

export function ShareModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  isOwner = true,
}: ShareModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Active Tab: 'share' | 'passcodes'
  const [activeTab, setActiveTab] = useState<'share' | 'passcodes'>('share');

  // Share links data
  const [links, setLinks] = useState<ShareLinkItem[]>([]);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isFetchingLinks, setIsFetchingLinks] = useState(false);

  // New passcode form state
  const [customPasscode, setCustomPasscode] = useState('');
  const [expiresOption, setExpiresOption] = useState('7');
  const [canView, setCanView] = useState(true);
  const [canUpload, setCanUpload] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  const getFullShareUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${token}`;
    }
    return `/share/${token}`;
  };

  // Dialog open/close lifecycle
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      if (previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Backdrop click closes dialog
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Fetch existing share links when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    async function fetchLinks() {
      setIsFetchingLinks(true);
      try {
        const res = await fetch(`/api/events/${eventId}/share-links`);
        const data = await res.json();
        if (!ignore && res.ok) {
          const fetchedLinks: ShareLinkItem[] = data.shareLinks || [];
          setLinks(fetchedLinks);
          const firstActive = fetchedLinks.find((l) => !l.isRevoked);
          if (firstActive) {
            setLatestToken(firstActive.token);
          } else if (isOwner) {
            // Auto-create initial default passcode if none exists
            const createRes = await fetch(`/api/events/${eventId}/share-links`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                canView: true,
                canUpload: true,
                expiresInDays: 7,
              }),
            });
            const createData = await createRes.json();
            if (!ignore && createRes.ok && createData.shareLink) {
              setLinks([createData.shareLink]);
              setLatestToken(createData.shareLink.token);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load share links:', err);
      } finally {
        if (!ignore) {
          setIsFetchingLinks(false);
        }
      }
    }

    fetchLinks();
    return () => {
      ignore = true;
    };
  }, [isOpen, eventId, isOwner]);

  // Generate QR code when active token changes
  useEffect(() => {
    if (!latestToken) {
      setQrDataUrl(null);
      return;
    }

    let active = true;
    const shareUrl = getFullShareUrl(latestToken);
    QRCode.toDataURL(shareUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#3B2B26', // ink color
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.error('Failed to generate QR code:', err));

    return () => {
      active = false;
    };
  }, [latestToken]);

  // Copy helper
  const handleCopy = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg);
    } catch {
      showToast('Couldn’t copy. Select it and copy by hand.');
    }
  };

  // Create new passcode and link
  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canView && !canUpload) {
      showToast('Turn on viewing or uploads');
      return;
    }

    const formattedCode = customPasscode.trim().toUpperCase();

    // Check client-side collision with active links
    if (formattedCode && links.some((l) => l.token.toUpperCase() === formattedCode && !l.isRevoked)) {
      showToast('That passcode is taken');
      return;
    }

    setIsCreating(true);
    try {
      const expiresInDays = expiresOption === 'never' ? null : parseInt(expiresOption, 10);
      const res = await fetch(`/api/events/${eventId}/share-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canView,
          canUpload,
          expiresInDays,
          customPasscode: formattedCode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 || data.error?.includes('already taken')) {
          showToast('That passcode is taken');
        } else {
          showToast(data.error || 'Failed to create passcode');
        }
        return;
      }

      setLinks((prev) => [data.shareLink, ...prev]);
      setLatestToken(data.shareLink.token);
      setCustomPasscode('');
      showToast('Passcode created');
    } catch (err: unknown) {
      showToast((err as Error).message || 'Failed to create passcode');
    } finally {
      setIsCreating(false);
    }
  };

  // Revoke passcode
  const handleRevoke = async (link: ShareLinkItem) => {
    try {
      const res = await fetch(`/api/events/${eventId}/share-links/${link.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke link');

      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, isRevoked: true } : l))
      );

      if (latestToken === link.token) {
        const nextActive = links.find((l) => l.id !== link.id && !l.isRevoked);
        setLatestToken(nextActive ? nextActive.token : null);
      }

      showToast(`Revoked ${link.token}`);
    } catch {
      showToast('Couldn’t revoke passcode. Try again.');
    }
  };

  // Download QR image
  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    showToast('Saving the QR image…');
    const link = document.createElement('a');
    link.download = `event-qr-${eventName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = qrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeLinks = links.filter((l) => !l.isRevoked);
  const activeLink = links.find((l) => l.token === latestToken && !l.isRevoked) || activeLinks[0];
  const shareUrl = latestToken ? getFullShareUrl(latestToken) : '';

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const diffDays = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        id="share"
        className="loveall-modal"
        aria-labelledby="st"
        onClick={handleDialogClick}
      >
        <div className="dh">
          <div>
            <h2 id="st">Share this event</h2>
            <p>Anyone with the passcode, link or QR code can join as a guest. No account needed.</p>
          </div>
          <button
            className="x"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="db">
          {/* Two-tab switch under header (only hosts see passcodes tab) */}
          {isOwner && (
            <div className="seg2" role="group" aria-label="Share sections">
              <button
                type="button"
                aria-pressed={activeTab === 'share'}
                onClick={() => setActiveTab('share')}
              >
                Share
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'passcodes'}
                onClick={() => setActiveTab('passcodes')}
              >
                Passcodes <span>({activeLinks.length})</span>
              </button>
            </div>
          )}

          {/* SHARE TAB */}
          <div id="s1" className="db" style={{ padding: 0, overflow: 'visible' }} hidden={activeTab !== 'share'}>
            {/* Lilac passcode card */}
            <div className="card code">
              <div>
                <small>Event passcode</small>
                <strong
                  id="pcode"
                  style={{
                    fontSize: latestToken
                      ? 'clamp(2.2rem, 11vw, 3.2rem)'
                      : 'clamp(1.3rem, 5vw, 1.8rem)',
                    letterSpacing: latestToken ? '.14em' : 'normal',
                  }}
                >
                  {latestToken ? latestToken : isFetchingLinks ? 'GENERATING…' : 'NO CODE'}
                </strong>
              </div>
              <button
                className="btn go"
                type="button"
                disabled={!latestToken}
                onClick={() => latestToken && handleCopy(latestToken, 'Passcode copied')}
              >
                Copy code
              </button>
            </div>

            {/* QR Row */}
            <div className="qrrow">
              <figure className="polaroid" style={{ margin: 0 }}>
                <div id="qr">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR code to join the event" />
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '0.85rem' }}>
                      {isFetchingLinks ? 'Generating QR…' : 'No active QR code'}
                    </div>
                  )}
                </div>
                <figcaption>Scan to join</figcaption>
              </figure>

              <div className="link">
                <h3>Direct guest link</h3>
                <p>Opening the link or scanning the code gives instant guest access.</p>

                <div className="copyrow">
                  <label className="field">
                    <span className="sr" style={{ position: 'absolute', left: '-9999px' }}>
                      Guest link
                    </span>
                    <input
                      id="glink"
                      readOnly
                      placeholder={isFetchingLinks ? 'Generating link…' : ''}
                      value={shareUrl}
                    />
                  </label>
                  <button
                    className="btn sm mint"
                    type="button"
                    disabled={!shareUrl}
                    onClick={() => shareUrl && handleCopy(shareUrl, 'Link copied')}
                  >
                    Copy link
                  </button>
                </div>

                <div className="perms">
                  {activeLink?.canView && <span className="pill">Guests can view</span>}
                  {activeLink?.canUpload && <span className="pill">Guests can upload</span>}
                  {activeLink?.expiresAt ? (
                    <span className="pill" style={{ background: 'var(--sun)' }}>
                      Expires in {Math.max(1, Math.ceil((new Date(activeLink.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                    </span>
                  ) : activeLink ? (
                    <span className="pill" style={{ background: 'var(--lilac)' }}>
                      No expiry
                    </span>
                  ) : null}
                </div>

                <button
                  className="btn sm"
                  type="button"
                  id="saveqr"
                  style={{ justifySelf: 'start' }}
                  onClick={handleDownloadQr}
                  disabled={!qrDataUrl}
                >
                  Save QR image
                </button>
              </div>
            </div>
          </div>

          {/* PASSCODES TAB (Host only) */}
          {isOwner && (
            <div id="s2" className="db" style={{ padding: 0, overflow: 'visible' }} hidden={activeTab !== 'passcodes'}>
              <form className="card" id="newcode" onSubmit={handleCreatePasscode} style={{ display: 'grid', gap: '14px' }}>
                <h3 style={{ fontSize: '1.35rem', margin: 0 }}>Create a passcode and link</h3>

                <div className="opts" style={{ gridTemplateColumns: '1fr' }}>
                  <label className="field">
                    Custom passcode (optional)
                    <input
                      id="custom"
                      maxLength={10}
                      placeholder="Leave blank to make one"
                      autoCapitalize="characters"
                      autoComplete="off"
                      value={customPasscode}
                      onChange={(e) => setCustomPasscode(e.target.value.toUpperCase())}
                      style={{ textTransform: 'uppercase' }}
                    />
                  </label>

                  <label className="field">
                    Link expires
                    <select
                      id="exp"
                      value={expiresOption}
                      onChange={(e) => setExpiresOption(e.target.value)}
                    >
                      <option value="7">7 days</option>
                      <option value="1">1 day</option>
                      <option value="30">30 days</option>
                      <option value="never">Never</option>
                    </select>
                  </label>
                </div>

                <div className="opts">
                  <label className="opt">
                    <input
                      type="checkbox"
                      id="pv"
                      checked={canView}
                      onChange={(e) => setCanView(e.target.checked)}
                    />
                    <span>
                      <b>Allow viewing</b>
                      <small>Guests can browse the gallery</small>
                    </span>
                  </label>

                  <label className="opt">
                    <input
                      type="checkbox"
                      id="pu"
                      checked={canUpload}
                      onChange={(e) => setCanUpload(e.target.checked)}
                    />
                    <span>
                      <b>Allow uploads</b>
                      <small>Guests can add photos</small>
                    </span>
                  </label>
                </div>

                <button
                  className="btn go"
                  type="submit"
                  disabled={isCreating}
                  style={{ width: '100%' }}
                >
                  {isCreating ? 'Creating…' : 'Create passcode and link'}
                </button>
              </form>

              <h3 className="sec">All event passcodes</h3>
              <ul className="rows" id="codes">
                {activeLinks.length > 0 ? (
                  activeLinks.map((k, i) => (
                    <li key={k.id} className="row">
                      <div className="face" style={{ ['--c' as any]: 'var(--lilac)' }} aria-hidden="true">
                        #
                      </div>
                      <div>
                        <div className="nm">
                          {k.token}
                          {i === 0 && <span className="tag y">Main</span>}
                        </div>
                        <div className="em">
                          Expires: {formatExpiry(k.expiresAt)} ·{' '}
                          {k.canView && k.canUpload
                            ? 'View and upload'
                            : k.canView
                            ? 'View only'
                            : k.canUpload
                            ? 'Upload only'
                            : 'No permissions'}
                        </div>
                      </div>
                      <div className="acts2">
                        <button
                          className="btn sm mint"
                          type="button"
                          onClick={() => handleCopy(k.token, 'Passcode copied')}
                        >
                          Copy
                        </button>
                        {i !== 0 && (
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => handleRevoke(k)}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="empty">No passcodes yet.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </dialog>

      {/* Confirmation Toast */}
      <div
        className={`loveall-toast${toastMessage ? ' on' : ''}`}
        role="status"
        aria-live="polite"
      >
        {toastMessage}
      </div>
    </>
  );
}
