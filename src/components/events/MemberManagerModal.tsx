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
          <form onSubmit={handleAddMember} className="flex flex-col sm:flex-row items-end gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="flex-1 w-full">
              <Input
                label="Invite Collaborator"
                type="email"
                placeholder="colleague@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-32">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1 block">Role</label>
              <select
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value as 'MEMBER' | 'OWNER')}
                className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="MEMBER">Member</option>
                <option value="OWNER">Owner</option>
              </select>
            </div>
            <Button type="submit" size="md" variant="primary" isLoading={isLoading} className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-1.5" />
              Invite
            </Button>
          </form>
        )}

        {/* Members List */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
          {members.map((member) => {
            const isCurrentUser = member.user.id === currentUserId;
            return (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {member.user.image ? (
                    <img
                      src={member.user.image}
                      alt={member.user.name || 'Member'}
                      className="h-9 w-9 rounded-full object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-xs dark:bg-indigo-950 dark:text-indigo-300">
                      {(member.user.name || member.user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {member.user.name || member.user.email}
                      </span>
                      {isCurrentUser && (
                        <span className="text-[10px] bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 px-1.5 py-0.2 rounded-sm font-medium">
                          You
                        </span>
                      )}
                    </div>
                    {member.user.email && (
                      <p className="text-xs text-zinc-500">{member.user.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role === 'OWNER' ? (
                    <Badge variant="purple">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Owner
                    </Badge>
                  ) : (
                    <Badge variant="primary">Member</Badge>
                  )}

                  {isOwner && !isCurrentUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.user.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1.5 h-8 w-8"
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
