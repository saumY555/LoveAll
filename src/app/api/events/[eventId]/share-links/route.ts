import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireEventRole } from '@/lib/permissions';
import { EventRole } from '@prisma/client';
import { z } from 'zod';

const createShareLinkSchema = z.object({
  canView: z.boolean().default(true),
  canUpload: z.boolean().default(false),
  expiresInDays: z.number().int().positive().nullable().optional(),
});

/**
 * GET /api/events/[eventId]/share-links
 * List all share links for this event (Owner only)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: roleCheck.error || 'Only the event owner can manage share links' },
        { status: roleCheck.statusCode || 403 }
      );
    }

    const shareLinks = await prisma.shareLink.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ shareLinks });
  } catch (err: unknown) {
    console.error('[API share-links GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to list share links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/share-links
 * Create a new tokenized share link with customizable capabilities (Owner only)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roleCheck = await requireEventRole(eventId, session.user.id, [EventRole.OWNER]);
    if (!roleCheck.allowed) {
      return NextResponse.json(
        { error: roleCheck.error || 'Only the event owner can create share links' },
        { status: roleCheck.statusCode || 403 }
      );
    }

    const body = await req.json();
    const parsed = createShareLinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid share link options', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { canView, canUpload, expiresInDays } = parsed.data;

    // Cryptographically secure 24-character hexadecimal token
    const token = crypto.randomBytes(16).toString('hex');

    let expiresAt: Date | null = null;
    if (expiresInDays) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    const shareLink = await prisma.shareLink.create({
      data: {
        eventId,
        token,
        canView,
        canUpload,
        expiresAt,
      },
    });

    return NextResponse.json({ shareLink }, { status: 201 });
  } catch (err: unknown) {
    console.error('[API share-links POST error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create share link' },
      { status: 500 }
    );
  }
}
