import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';

const HEARTBEAT_FILE = path.resolve(process.cwd(), 'storage', 'worker_heartbeat.json');
const HEARTBEAT_STALE_MS = 20_000; // Consider worker heartbeat stale after 20 seconds

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

    // Check worker heartbeat
    let isWorkerAlive = false;
    try {
      if (fs.existsSync(HEARTBEAT_FILE)) {
        const raw = fs.readFileSync(HEARTBEAT_FILE, 'utf8');
        const hb = JSON.parse(raw);
        if (Date.now() - hb.timestamp < HEARTBEAT_STALE_MS) {
          isWorkerAlive = true;
        }
      }
    } catch {
      isWorkerAlive = false;
    }

    // Check if any photo has been PENDING for > 30 seconds
    let hasStalePending = false;
    if (counts.pending > 0) {
      const thirtySecAgo = new Date(Date.now() - 30_000);
      const stalePhoto = await prisma.photo.findFirst({
        where: {
          eventId,
          faceStatus: 'PENDING',
          isDeleted: false,
          createdAt: { lt: thirtySecAgo },
        },
        select: { id: true },
      });
      if (stalePhoto) {
        hasStalePending = true;
      }
    }

    const serviceWarning =
      hasStalePending && !isWorkerAlive ? "Processing service isn't running" : null;

    return NextResponse.json({
      ...counts,
      serviceRunning: isWorkerAlive,
      serviceWarning,
    });
  } catch (err: unknown) {
    console.error('[API faces status GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to fetch face scan status' },
      { status: 500 }
    );
  }
}
