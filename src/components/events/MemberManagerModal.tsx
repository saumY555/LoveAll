'use client';

import React, { useState, useEffect, useRef } from 'react';

const MEMBER_COLORS = [
  'var(--pink)',
  'var(--mint)',
  'var(--lilac)',
  'var(--sun)',
  '#F7B08F',
  '#9FE3F2',
  '#F4C6A3',
  '#BFE8A6',
];

interface Member {
  id: string;
  role: 'OWNER' | 'MEMBER';
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface PendingInvite {
  email: string;
  role: 'Member' | 'Host';
  id: string;
}

interface MemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  isOwner: boolean;
  currentUserId?: string;
  initialMembers: Member[];
  onMembersUpdated?: () => void;
}

export function MemberManagerModal({
  isOpen,
  onClose,
  eventId,
  isOwner,
  currentUserId,
  initialMembers,
  onMembersUpdated,
}: MemberManagerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Invite Form
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'Member' | 'Host'>('Member');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);

  // Confirm Remove dialog
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<Member | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  };

  // Keep members in sync with initialMembers
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

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

  // Fetch fresh members on open
  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;
    async function loadMembers() {
      try {
        const res = await fetch(`/api/events/${eventId}/members`);
        const data = await res.json();
        if (!ignore && res.ok && data.members) {
          setMembers(data.members);
        }
      } catch (err) {
        console.warn('Failed to load members:', err);
      }
    }
    loadMembers();
    return () => {
      ignore = true;
    };
  }, [isOpen, eventId]);

  // Handle Invite Form Submission
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(null);

    // Check if user is already a member
    if (members.some((m) => m.user.email?.toLowerCase() === cleanEmail)) {
      setEmailError('This person is already a member of this event.');
      return;
    }

    setIsInviting(true);
    try {
      const dbRole = roleInput === 'Host' ? 'OWNER' : 'MEMBER';
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, role: dbRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || 'Failed to send invite');
        return;
      }

      if (data.member) {
        setMembers((prev) => [...prev, data.member]);
      } else {
        setPendingInvites((prev) => [
          ...prev,
          { email: cleanEmail, role: roleInput, id: String(Date.now()) },
        ]);
      }

      setEmailInput('');
      showToast('Invite sent');
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: unknown) {
      setEmailError((err as Error).message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  // Handle Role Change
  const handleRoleChange = async (member: Member, newRoleLabel: string) => {
    const newDbRole = newRoleLabel === 'Host' ? 'OWNER' : 'MEMBER';
    const memberName = member.user.name || member.user.email || 'Member';

    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.user.id, role: newDbRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('Couldn’t change the role. Try again.');
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.user.id === member.user.id ? { ...m, role: newDbRole } : m))
      );

      showToast(`${memberName} is now a ${newRoleLabel.toLowerCase()}`);
      if (onMembersUpdated) onMembersUpdated();
    } catch {
      showToast('Couldn’t change the role. Try again.');
    }
  };

  // Handle Remove Member
  const handleRemoveMember = async (userId: string, memberName: string) => {
    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || `Couldn’t remove ${memberName}. Try again.`);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      showToast(`Removed ${memberName}`);
      if (onMembersUpdated) onMembersUpdated();
    } catch {
      showToast(`Couldn’t remove ${memberName}. Try again.`);
    }
  };

  return (
    <>
      <dialog
        ref={dialogRef}
        id="members"
        className="loveall-modal"
        aria-labelledby="mt"
        onClick={handleDialogClick}
      >
        <div className="dh">
          <div>
            <h2 id="mt">Members</h2>
            <p>See who’s in this event, change roles, or invite people.</p>
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
          {/* Invite Form (Hosts only) */}
          {isOwner && (
            <form className="card invite" id="inv" onSubmit={handleSendInvite}>
              <label className="field">
                Invite by email
                <input
                  id="ie"
                  type="email"
                  inputMode="email"
                  placeholder="friend@example.com"
                  autoComplete="off"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  required
                />
                {emailError && (
                  <span style={{ color: 'var(--tomato)', fontSize: '0.82rem', marginTop: '2px', fontWeight: 800 }}>
                    {emailError}
                  </span>
                )}
              </label>

              <label className="field">
                Role
                <select
                  id="ir"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value as 'Member' | 'Host')}
                >
                  <option value="Member">Member</option>
                  <option value="Host">Host</option>
                </select>
              </label>

              <button className="btn go" type="submit" disabled={isInviting}>
                {isInviting ? 'Sending…' : 'Send invite'}
              </button>
            </form>
          )}

          {/* People Count Heading */}
          <h3 className="sec" id="mc">
            People ({members.length})
          </h3>

          {/* Members List */}
          <ul className="rows" id="people">
            {members.map((p, idx) => {
              const isCurrentUser = p.user.id === currentUserId;
              const isFirstOwner = p.role === 'OWNER' && idx === 0;
              const color = MEMBER_COLORS[idx % MEMBER_COLORS.length];
              const initial = (p.user.name || p.user.email || 'U')[0].toUpperCase();
              const displayName = p.user.name || p.user.email?.split('@')[0] || 'Member';

              return (
                <li key={p.id} className="row">
                  <div className="face" style={{ ['--c' as any]: color }} aria-hidden="true">
                    {p.user.image ? (
                      <img src={p.user.image} alt={displayName} />
                    ) : (
                      initial
                    )}
                  </div>

                  <div>
                    <div className="nm">
                      {displayName}
                      {isCurrentUser && <span className="tag">You</span>}
                    </div>
                    {p.user.email && <div className="em">{p.user.email}</div>}
                  </div>

                  <div className="acts2">
                    {isFirstOwner ? (
                      <span className="tag y" style={{ margin: 0 }}>
                        Host and owner
                      </span>
                    ) : isOwner ? (
                      <>
                        <select
                          aria-label={`Role for ${displayName}`}
                          value={p.role === 'OWNER' ? 'Host' : 'Member'}
                          onChange={(e) => handleRoleChange(p, e.target.value)}
                        >
                          <option value="Member">Member</option>
                          <option value="Host">Host</option>
                        </select>
                        {!isCurrentUser && (
                          <button
                            className="btn sm"
                            type="button"
                            aria-label={`Remove ${displayName}`}
                            onClick={() => setConfirmRemoveMember(p)}
                          >
                            Remove
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="tag" style={{ margin: 0 }}>
                        {p.role === 'OWNER' ? 'Host' : 'Member'}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Waiting to Join Section */}
          {pendingInvites.length > 0 && (
            <>
              <h3 className="sec" id="ph">
                Waiting to join
              </h3>
              <ul className="rows" id="pend">
                {pendingInvites.map((inv, idx) => (
                  <li key={inv.id} className="row">
                    <div className="face" style={{ ['--c' as any]: 'var(--sun)' }} aria-hidden="true">
                      ?
                    </div>
                    <div>
                      <div className="nm">
                        {inv.email}
                        <span className="tag m">Invited</span>
                      </div>
                      <div className="em">Will join as {inv.role.toLowerCase()}</div>
                    </div>
                    <div className="acts2">
                      <button
                        className="btn sm mint"
                        type="button"
                        onClick={() => showToast('Invite sent again')}
                      >
                        Resend
                      </button>
                      <button
                        className="btn sm"
                        type="button"
                        onClick={() => {
                          setPendingInvites((prev) => prev.filter((_, i) => i !== idx));
                          showToast('Invite cancelled');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </dialog>

      {/* Confirmation Dialog for Removing a Member */}
      {confirmRemoveMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(59, 43, 38, .55)',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmRemoveMember(null);
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              textAlign: 'center',
              background: '#fff',
            }}
          >
            <h3 style={{ fontSize: '1.35rem', marginBottom: '8px' }}>
              Remove {confirmRemoveMember.user.name || confirmRemoveMember.user.email} from this event?
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.45 }}>
              They will lose access immediately. Their uploaded photos will remain in the gallery.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                className="btn sm"
                type="button"
                onClick={() => setConfirmRemoveMember(null)}
              >
                Cancel
              </button>
              <button
                className="btn go sm"
                type="button"
                onClick={() => {
                  handleRemoveMember(
                    confirmRemoveMember.user.id,
                    confirmRemoveMember.user.name || confirmRemoveMember.user.email || 'Member'
                  );
                  setConfirmRemoveMember(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
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
