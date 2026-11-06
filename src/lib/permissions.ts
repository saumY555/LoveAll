import { prisma } from './db';
import { Event, EventRole } from '@prisma/client';

export interface EventAccessResult {
  hasAccess: boolean;
  role: 'OWNER' | 'MEMBER' | null;
  isOwner: boolean;
  isGuest?: boolean;
  canGuestUpload?: boolean;
  guestIdentity?: {
    id: string;
    displayName: string | null;
  } | null;
  event: Event | null;
  error?: string;
  statusCode?: number;
}

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

// 20-second in-memory access cache to eliminate redundant DB permission round-trips
const accessCache = new Map<string, CacheItem<EventAccessResult>>();

export function invalidateEventAccessCache(eventId: string) {
  for (const key of accessCache.keys()) {
    if (key.startsWith(`${eventId}:`)) {
      accessCache.delete(key);
    }
  }
}

/**
 * Validates whether a user, invited member, or temporary guest has access to a specific event.
 * Server-side verified against the database with short-lived memory caching.
 */
export async function checkEventAccess(
  eventId: string,
  userId?: string | null,
  options: { allowDeleted?: boolean; guestToken?: string | null } = {}
): Promise<EventAccessResult> {
  const cacheKey = `${eventId}:${userId || 'anon'}:${options.guestToken || 'none'}:${options.allowDeleted ? '1' : '0'}`;
  const cached = accessCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      members: userId ? { where: { userId } } : false,
    },
  });

  if (!event) {
    const notFound: EventAccessResult = {
      hasAccess: false,
      role: null,
      isOwner: false,
      event: null,
      error: 'Event not found',
      statusCode: 404,
    };
    accessCache.set(cacheKey, { value: notFound, expiresAt: Date.now() + 5_000 });
    return notFound;
  }

  // Handle soft deletion: only owners can view deleted events during the recovery window
  if (event.isDeleted && !options.allowDeleted) {
    const deletedRes: EventAccessResult = {
      hasAccess: false,
      role: null,
      isOwner: false,
      event: null,
      error: 'Event has been deleted',
      statusCode: 410,
    };
    accessCache.set(cacheKey, { value: deletedRes, expiresAt: Date.now() + 5_000 });
    return deletedRes;
  }

  // 1. Check registered membership
  const membership = userId && event.members && event.members.length > 0 ? event.members[0] : null;
  const role = membership ? membership.role : null;
  const isOwner = role === EventRole.OWNER;

  if (role) {
    const memberAccess: EventAccessResult = {
      hasAccess: true,
      role,
      isOwner,
      event,
    };
    accessCache.set(cacheKey, { value: memberAccess, expiresAt: Date.now() + 20_000 });
    return memberAccess;
  }

  // 2. Check temporary guest identity (via tokenized share link cookie)
  if (options.guestToken) {
    const guest = await prisma.guestIdentity.findUnique({
      where: { temporaryToken: options.guestToken },
    });

    if (guest && guest.eventId === eventId && new Date() < guest.expiresAt) {
      // Check if there is an active share link for this event that permits upload
      const activeShare = await prisma.shareLink.findFirst({
        where: {
          eventId,
          isRevoked: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { canUpload: 'desc' },
      });

      // If the event is private or does not permit general guest view, and no active share link exists, deny
      if (!activeShare && (event.isPrivate || !event.allowGuestView)) {
        const denied: EventAccessResult = {
          hasAccess: false,
          role: null,
          isOwner: false,
          event: null,
          error: 'The share link used to access this event has expired or been revoked.',
          statusCode: 403,
        };
        accessCache.set(cacheKey, { value: denied, expiresAt: Date.now() + 10_000 });
        return denied;
      }

      const guestAccess: EventAccessResult = {
        hasAccess: true,
        role: null,
        isOwner: false,
        isGuest: true,
        canGuestUpload: activeShare ? activeShare.canUpload : event.allowGuestUpload,
        guestIdentity: {
          id: guest.id,
          displayName: guest.displayName,
        },
        event,
      };
      accessCache.set(cacheKey, { value: guestAccess, expiresAt: Date.now() + 20_000 });
      return guestAccess;
    }
  }

  // 3. Check public guest view permissions
  if (!event.isPrivate || event.allowGuestView) {
    const publicAccess: EventAccessResult = {
      hasAccess: true,
      role: null,
      isOwner: false,
      isGuest: true,
      canGuestUpload: event.allowGuestUpload,
      event,
    };
    accessCache.set(cacheKey, { value: publicAccess, expiresAt: Date.now() + 20_000 });
    return publicAccess;
  }

  const denied: EventAccessResult = {
    hasAccess: false,
    role: null,
    isOwner: false,
    event: null,
    error: 'Access denied. You need an invite or share link to view this event.',
    statusCode: 403,
  };
  accessCache.set(cacheKey, { value: denied, expiresAt: Date.now() + 10_000 });
  return denied;
}

/**
 * Enforce that the user has a specific role (e.g. OWNER) in the event.
 */
export async function requireEventRole(
  eventId: string,
  userId: string,
  allowedRoles: EventRole[]
): Promise<{ allowed: boolean; role?: EventRole; error?: string; statusCode?: number }> {
  if (!userId) {
    return {
      allowed: false,
      error: 'Authentication required',
      statusCode: 401,
    };
  }

  const membership = await prisma.eventMember.findUnique({
    where: {
      eventId_userId: {
        eventId,
        userId,
      },
    },
    include: {
      event: true,
    },
  });

  if (!membership) {
    return {
      allowed: false,
      error: 'You are not a member of this event',
      statusCode: 403,
    };
  }

  if (membership.event.isDeleted) {
    return {
      allowed: false,
      error: 'Event has been deleted',
      statusCode: 410,
    };
  }

  if (!allowedRoles.includes(membership.role)) {
    return {
      allowed: false,
      error: `Requires one of roles: [${allowedRoles.join(', ')}]. You have role: ${membership.role}`,
      statusCode: 403,
    };
  }

  return {
    allowed: true,
    role: membership.role,
  };
}
