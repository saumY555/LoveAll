/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck, UserMinus, UserPlus, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<'MEMBER' | 'OWNER'>('MEMBER');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim(), role: roleInput }),
      });

      let data: { member?: Member; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Fallback for non-JSON response body
      }

      if (!res.ok) {
        throw new Error(data.error || `Server returned error (${res.status})`);
      }

      if (data.member) {
        setMembers((prev) => [...prev, data.member!]);
      }
      setEmailInput('');
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member? Their uploaded photos will remain in the gallery.')) {
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Fallback
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to remove member (${res.status})`);
      }

      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  const handleLeaveEvent = async () => {
    if (!confirm('Are you sure you want to leave this event? Your uploaded photos will stay in the gallery.')) {
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}/leave`, {
        method: 'POST',
      });

      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // Fallback
      }

      if (!res.ok) {
        throw new Error(data.error || `Failed to leave event (${res.status})`);
      }

      router.push('/events');
    } catch (err: unknown) {
      alert((err as Error).message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Members & Permissions"
      description="View participants, manage access roles, or invite collaborators."
      maxWidth="lg"
    >
      <div className="space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Invite by Email (Owner only) */}
        {isOwner && (
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row items-end gap-3 rounded-3xl border-2 border-purple-200/90 bg-purple-50/50 p-4.5 dark:border-purple-900/60 dark:bg-purple-950/30">
            <div className="flex-1 w-full">
              <Input
                label="Invite Collaborator ✨"
                type="email"
                placeholder="friend@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1 block">Role</label>
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as 'MEMBER' | 'OWNER')}
                className="h-11 w-full rounded-2xl border-2 border-stone-200 bg-white/90 px-3 text-xs font-bold text-stone-800 focus:outline-none focus:border-purple-400 dark:border-stone-750 dark:bg-stone-900 dark:text-stone-100 shadow-2xs"
              >
                <option value="MEMBER">Member</option>
                <option value="OWNER">Host/Owner</option>
              </select>
            </div>
            <Button type="submit" size="md" variant="primary" isLoading={isLoading} className="w-full sm:w-auto px-6 h-11 shadow-xs">
              <UserPlus className="w-4 h-4 mr-1.5" />
              <span>Invite</span>
            </Button>
          </form>
        )}

        {/* Members List */}
        <div className="divide-y divide-stone-150 dark:divide-stone-800 max-h-72 overflow-y-auto pr-1">
          {members.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;
            return (
              <div key={member.id} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  {member.user.image ? (
                    <img
                      src={member.user.image}
                      alt={member.user.name || 'Member'}
                      className="h-10 w-10 rounded-full object-cover border-2 border-pink-300 ring-2 ring-purple-100 dark:border-pink-700"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-pink-200 to-purple-200 text-purple-700 font-black text-xs border border-purple-300">
                      {(member.user.name || member.user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {member.user.name || member.user.email}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">
                          You
                        </span>
                      )}
                    </div>
                    {member.user.email && (
                      <p className="text-xs text-stone-500 font-medium">{member.user.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role === 'OWNER' ? (
                    <Badge variant="lavender" className="px-3 py-1">
                      <ShieldCheck className="w-3 h-3 mr-1 text-purple-600" />
                      Host
                    </Badge>
                  ) : (
                    <Badge variant="sky" className="px-3 py-1">Member</Badge>
                  )}

                  {isOwner && !isCurrentUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 p-1.5 h-8 w-8 rounded-full"
                      title="Remove member"
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer actions: Member leave button */}
        {!isOwner && (
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <span className="text-xs text-zinc-500">Leaving an event revokes your access to private photos.</span>
            <Button variant="danger" size="sm" onClick={handleLeaveEvent}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Leave Event
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
