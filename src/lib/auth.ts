import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';
import { hashPassword, verifyPassword } from './passwords';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

const isDev = process.env.NODE_ENV === 'development';
const isDevAuthEnabled = isDev && process.env.ENABLE_DEV_AUTH_SHORTCUT === 'true';

// Construct providers dynamically
const providers = [
  // 1. Email and Password Credentials Provider
  Credentials({
    id: 'credentials',
    name: 'Email and Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      name: { label: 'Name', type: 'text' },
      action: { label: 'Action', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Email and password are required');
      }

      const email = String(credentials.email).toLowerCase().trim();
      const password = String(credentials.password);
      const name = credentials.name ? String(credentials.name).trim() : email.split('@')[0];
      const action = String(credentials.action || 'signin');

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (action === 'signup') {
        if (user) {
          throw new Error('Account already exists for this email');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        const newUser = await prisma.user.create({
          data: {
            email,
            name,
            passwordHash: hashPassword(password),
            image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          },
        });
        return {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          image: newUser.image,
        };
      }

      // Default: Sign In
      if (!user) {
        throw new Error('No account found with this email');
      }

      if (!user.passwordHash) {
        // Migrated / test account without password -> securely set password now
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: hashPassword(password) },
        });
        return {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          image: updatedUser.image,
        };
      }

      const isMatch = verifyPassword(password, user.passwordHash);
      if (!isMatch) {
        throw new Error('Incorrect password');
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      };
    },
  }),

  // 2. Dev 1-Click Quick Login Provider
  Credentials({
    id: 'dev-login',
    name: 'Development Quick Login',
    credentials: {
      email: { label: 'Email', type: 'email', placeholder: 'alice@example.com' },
      name: { label: 'Name', type: 'text', placeholder: 'Alice Cooper' },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null;
      const email = String(credentials.email).toLowerCase().trim();
      const name = credentials.name ? String(credentials.name).trim() : email.split('@')[0];

      try {
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

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      } catch (dbErr) {
        console.error('[NextAuth] Error in dev-login authorize:', dbErr);
        throw dbErr;
      }
    },
  }),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'e94fae48937968db8805f9c46d3e232ad300b97cb00fa1c7ad1ad7efba2a1883',
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Return relative URLs directly so browser navigates to the current host (e.g. Cloudflare tunnel or mobile LAN)
      if (url.startsWith('/')) return url;
      try {
        const parsed = new URL(url);
        if (
          parsed.origin === baseUrl ||
          parsed.hostname.endsWith('.trycloudflare.com') ||
          parsed.hostname.endsWith('.loca.lt') ||
          parsed.hostname.endsWith('.ngrok-free.app') ||
          parsed.hostname.endsWith('.ngrok.io') ||
          parsed.hostname === 'localhost' ||
          parsed.hostname === '127.0.0.1' ||
          parsed.hostname.startsWith('192.168.') ||
          parsed.hostname.startsWith('10.')
        ) {
          return url;
        }
      } catch {
        // Fallback
      }
      return baseUrl;
    },
    async signIn({ user, account }) {
      // If logging in via OAuth, ensure user is created/synced with database
      if (account?.provider === 'google' && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name,
              image: user.image,
              emailVerified: new Date(),
            },
          });
          user.id = newUser.id;
        } else {
          user.id = existing.id;
        }
      }
      return true;
    },
  },
});

/**
 * Server helper to get current authenticated user session
 */
export async function getAuthSession() {
  const session = await auth();
  return session;
}
