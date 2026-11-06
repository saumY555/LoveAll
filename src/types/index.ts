import { Event, EventMember, User } from '@prisma/client';

export type EventRoleType = 'OWNER' | 'MEMBER';

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface EventWithRole extends Event {
  userRole?: EventRoleType | null;
  isGuest?: boolean;
  canGuestUpload?: boolean;
  guestIdentity?: {
    id: string;
    displayName: string | null;
  } | null;
  _count?: {
    members: number;
    photos: number;
  };
  members?: (EventMember & {
    user: Pick<User, 'id' | 'name' | 'email' | 'image'>;
  })[];
}

export interface CreateEventDTO {
  name: string;
  description?: string;
  coverImage?: string;
  eventDate?: string;
  isPrivate?: boolean;
  allowGuestView?: boolean;
  allowGuestUpload?: boolean;
}

export interface UpdateEventDTO {
  name?: string;
  description?: string;
  coverImage?: string;
  eventDate?: string;
  isPrivate?: boolean;
  allowGuestView?: boolean;
  allowGuestUpload?: boolean;
}
