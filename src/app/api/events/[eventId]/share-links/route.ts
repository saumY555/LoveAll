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
  customPasscode: z.string().trim().min(3).max(30).optional(),
});

function generateReadablePasscode(): string {
  // Clear uppercase alphanumeric chars (excluding visually confusing 0/O, 1/I/L)
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

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
 * Create a new tokenized share link or custom event passcode (Owner only)
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

    const { canView, canUpload, expiresInDays, customPasscode } = parsed.data;

    let token = '';

    if (customPasscode) {
      // Clean up custom passcode
      const sanitized = customPasscode.toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (sanitized.length < 3) {
        return NextResponse.json(
          { error: 'Passcode must be at least 3 alphanumeric characters' },
          { status: 400 }
        );
      }

      // Check for collision
      const existing = await prisma.shareLink.findFirst({
        where: {
          OR: [{ token: sanitized }, { token: sanitized.toLowerCase() }],
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `Passcode "${sanitized}" is already taken. Please choose another.` },
          { status: 409 }
        );
      }

      token = sanitized;
    } else {
      // Generate unique 6-character readable code
      let attempts = 0;
      while (attempts < 5) {
        const candidate = generateReadablePasscode();
        const existing = await prisma.shareLink.findUnique({
          where: { token: candidate },
        });
        if (!existing) {
          token = candidate;
          break;
        }
        attempts++;
      }
      if (!token) {
        // Fallback to 8-character hex
        token = crypto.randomBytes(4).toString('hex').toUpperCase();
      }
    }

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
