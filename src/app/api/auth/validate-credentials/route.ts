import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/passwords';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    const action = String(body.action || 'signin');
    const name = String(body.name || '').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (action === 'signup') {
      if (user) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please switch to Sign In.' },
          { status: 400 }
        );
      }
      if (!name) {
        return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters long.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Default: Sign In
    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Switch to "Create Account" above to register.' },
        { status: 404 }
      );
    }

    if (user.passwordHash) {
      const isValid = verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Incorrect password for this email. Please try again.' },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
