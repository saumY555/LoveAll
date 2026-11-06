import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';

/**
 * POST /api/events/[eventId]/faces/scan
 * Queue face detection for background processing and return 202 immediately.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    let session = null;
    try {
      session = await getAuthSession();
    } catch {
      // Fallback for non-request contexts or when headers() is called outside request store
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

    const { searchParams } = new URL(req.url);
    const forceRescan = searchParams.get('force') === 'true';

    // 1. Queue photos for background worker
    let updateResult;
    if (forceRescan) {
      updateResult = await prisma.photo.updateMany({
        where: {
          eventId,
          isDeleted: false,
        },
        data: {
          faceStatus: 'PENDING',
          faceError: null,
        },
      });
    } else {
      updateResult = await prisma.photo.updateMany({
        where: {
          eventId,
          isDeleted: false,
          faceStatus: { in: ['PENDING', 'FAILED'] },
        },
        data: {
          faceStatus: 'PENDING',
          faceError: null,
        },
      });
    }

    // 2. Fetch current counts for this event
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
    };

    for (const group of statusCounts) {
      counts.total += group._count._all;
      if (group.faceStatus === 'DONE') counts.done = group._count._all;
      else if (group.faceStatus === 'PENDING') counts.pending = group._count._all;
      else if (group.faceStatus === 'PROCESSING') counts.processing = group._count._all;
      else if (group.faceStatus === 'FAILED') counts.failed = group._count._all;
    }

    return NextResponse.json(
      {
        success: true,
        message: forceRescan
          ? `Queued all ${updateResult.count} photos for face scan.`
          : `Queued ${updateResult.count} photos for face scan.`,
        queuedCount: updateResult.count,
        counts,
      },
      { status: 202 }
    );
  } catch (err: unknown) {
    console.error('[API faces scan POST error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to queue face scan' },
      { status: 500 }
    );
  }
}
