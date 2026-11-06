import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireEventRole, invalidateEventAccessCache } from '@/lib/permissions';
import { EventRole } from '@prisma/client';

/**
 * DELETE /api/events/[eventId]/share-links/[linkId]
 * Revoke a share link immediately (Owner only)
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; linkId: string }> }
) {
  try {
    const { eventId, linkId } = await params;
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: roleCheck.error || 'Only the event owner can revoke share links' },
        { status: roleCheck.statusCode || 403 }
      );
    }

    const link = await prisma.shareLink.findFirst({
      where: { id: linkId, eventId },
    });

    if (!link) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const revokedLink = await prisma.shareLink.update({
      where: { id: linkId },
      data: { isRevoked: true },
    });

    // Invalidate access cache so revoked link takes effect immediately
    invalidateEventAccessCache(eventId);

    return NextResponse.json({
      success: true,
      message: 'Share link revoked successfully',
      shareLink: revokedLink,
    });
  } catch (err: unknown) {
    console.error('[API revoke share-link DELETE error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to revoke share link' },
      { status: 500 }
    );
  }
}
