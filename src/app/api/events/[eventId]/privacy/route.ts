import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkEventAccess } from '@/lib/permissions';
import { z } from 'zod';

const privacySchema = z.object({
  consent: z.boolean(),
});

/**
 * GET /api/events/[eventId]/privacy
 * Get current user's face recognition privacy consent status
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

    const access = await checkEventAccess(eventId, session.user.id);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const consent = await prisma.memberPrivacyConsent.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({
      consentFaceRecognition: consent ? consent.consentFaceRecognition : true,
      optedOutAt: consent?.optedOutAt || null,
    });
  } catch (err: unknown) {
    console.error('[API privacy GET error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to retrieve privacy status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/events/[eventId]/privacy
 * Update member privacy consent and purge data on opt-out
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

    const access = await checkEventAccess(eventId, session.user.id);
    if (!access.hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = privacySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid consent option' }, { status: 400 });
    }

    const wantsConsent = parsed.data.consent;

    const consent = await prisma.memberPrivacyConsent.upsert({
      where: {
        eventId_userId: {
          eventId,
          userId: session.user.id,
        },
      },
      update: {
        consentFaceRecognition: wantsConsent,
        optedOutAt: wantsConsent ? null : new Date(),
      },
      create: {
        eventId,
        userId: session.user.id,
        consentFaceRecognition: wantsConsent,
        optedOutAt: wantsConsent ? null : new Date(),
      },
    });

    // If opted out, dissociate/purge faces in photos uploaded exclusively by this user
    if (!wantsConsent) {
      const userPhotos = await prisma.photo.findMany({
        where: {
          eventId,
          uploadReferences: {
            every: { uploadedByUserId: session.user.id },
          },
        },
        select: { id: true },
      });

      const photoIds = userPhotos.map((p) => p.id);
      if (photoIds.length > 0) {
        await prisma.face.deleteMany({
          where: { photoId: { in: photoIds } },
        });

        // Clean up any empty Person entities
        await prisma.person.deleteMany({
          where: {
            eventId,
            faces: { none: {} },
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      consentFaceRecognition: consent.consentFaceRecognition,
      optedOutAt: consent.optedOutAt,
      message: wantsConsent
        ? 'Facial recognition consent granted.'
        : 'Facial recognition consent withdrawn and associated face data purged.',
    });
  } catch (err: unknown) {
    console.error('[API privacy POST error]:', err);
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update privacy consent' },
      { status: 500 }
    );
  }
}
