import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';

/**
 * GET /api/events/[eventId]/faces/status
 * Return current face scanning status and progress counts for an event.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    let session = null;
    try {
      session = await getAuthSession();
    } catch {
      // Fallback for non-request contexts
    }
    const userId = session?.user?.id;

    const guestToken =
      req.cookies.get(`guest_token_${eventId}`)?.value || req.headers.get('x-guest-token');

    const access = await checkEventAccess(eventId, userId, { guestToken });
    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.error || 'Access denied' },
        { status: access.statusCode || 403 }
      );
    }

    const statusCounts = await prisma.photo.groupBy({
      by: ['faceStatus'],
      where: { eventId, isDeleted: false },
      _count: { _all: true },
    });

    const counts = {
      total: 0,
      done: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      isScanning: false,
    };

    for (const group of statusCounts) {
      counts.total += group._count._all;
      if (group.faceStatus === 'DONE') counts.done = group._count._all;
      else if (group.faceStatus === 'PENDING') counts.pending = group._count._all;
      else if (group.faceStatus === 'PROCESSING') counts.processing = group._count._all;
      else if (group.faceStatus === 'FAILED') counts.failed = group._count._all;
    }

    counts.isScanning = counts.pending > 0 || counts.processing > 0;

    return NextResponse.json(counts);
  } catch (err: unknown) {
    console.error('[API faces status GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch face scan status' },
      { status: 500 }
    );
  }
}
