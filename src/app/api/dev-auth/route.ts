import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  // STRICT SECURITY GUARD:
  // Must be local development environment AND explicitly enabled via env var
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.ENABLE_DEV_AUTH_SHORTCUT !== 'true'
  ) {
    return NextResponse.json(
      { error: 'Forbidden: Development authentication shortcut is strictly disabled.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const email = body.email ? String(body.email).toLowerCase().trim() : 'alice@example.com';
    const name = body.name ? String(body.name).trim() : 'Alice Cooper';

    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to process dev auth' },
      { status: 500 }
    );
  }
}
