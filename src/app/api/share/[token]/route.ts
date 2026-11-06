import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const joinSchema = z.object({
  displayName: z.string().trim().max(50).optional(),
});

/**
 * GET /api/share/[token]
 * Validate a share link and fetch event preview info
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            description: true,
            coverImage: true,
            eventDate: true,
            isDeleted: true,
            _count: {
              select: {
                photos: { where: { isDeleted: false } },
                members: true,
              },
            },
          },
        },
      },
    });

    if (!shareLink) {
      return NextResponse.json({ error: 'Invalid or expired share link' }, { status: 404 });
    }

    if (shareLink.isRevoked) {
      return NextResponse.json(
        { error: 'This share link has been revoked by the event owner' },
        { status: 410 }
      );
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json(
        { error: 'This share link has expired' },
        { status: 410 }
      );
    }

    if (shareLink.event.isDeleted) {
      return NextResponse.json(
        { error: 'The event associated with this link has been deleted' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      shareLink: {
        id: shareLink.id,
        canView: shareLink.canView,
        canUpload: shareLink.canUpload,
        expiresAt: shareLink.expiresAt,
      },
      event: shareLink.event,
    });
  } catch (err: unknown) {
    console.error('[API share GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to validate share link' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/share/[token]
 * Join an event as a guest using a valid share link.
 * Creates a GuestIdentity and sets an HTTP-only session cookie.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = joinSchema.safeParse(body);
    const displayName = parsed.success && parsed.data.displayName ? parsed.data.displayName : 'Guest Attendee';

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
      include: { event: true },
    });

    if (!shareLink || shareLink.isRevoked) {
      return NextResponse.json({ error: 'Share link is not valid' }, { status: 403 });
    }

    if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
      return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
    }

    if (shareLink.event.isDeleted) {
      return NextResponse.json({ error: 'Event has been deleted' }, { status: 410 });
    }

    // Generate a temporary token for the guest session
    const temporaryToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = shareLink.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days default

    const guest = await prisma.guestIdentity.create({
      data: {
        eventId: shareLink.eventId,
        temporaryToken,
        displayName,
        expiresAt,
      },
    });

    const response = NextResponse.json({
      success: true,
      guestId: guest.id,
      displayName: guest.displayName,
      eventId: shareLink.eventId,
      canUpload: shareLink.canUpload,
      canView: shareLink.canView,
    });

    // Set secure HTTP-only cookie with the guest token for this event
    response.cookies.set(`guest_token_${shareLink.eventId}`, temporaryToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 14 * 24 * 60 * 60, // 14 days
    });

    return response;
  } catch (err: unknown) {
    console.error('[API share POST error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to join as guest' },
      { status: 500 }
    );
  }
}
