import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';

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
const providers = [];

// 1. Production Google OAuth Provider
const googleId = process.env.AUTH_GOOGLE_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET;
const hasRealGoogleCredentials =
  Boolean(googleId && googleSecret) && !googleId?.includes('your-google-client-id');

if (hasRealGoogleCredentials && googleId && googleSecret) {
  providers.push(
    Google({
      clientId: googleId,
      clientSecret: googleSecret,
    })
  );
}

// 2. Credentials Provider (Instant / Dev Sign-in)
// Available when in development, when enabled by env, or as a seamless fallback when Google OAuth is not configured yet
const allowCredentialsAuth =
  isDevAuthEnabled ||
  !hasRealGoogleCredentials ||
  process.env.ALLOW_CREDENTIALS_AUTH === 'true';

if (allowCredentialsAuth) {
  providers.push(
    Credentials({
      id: 'dev-login',
      name: 'Development Login',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'alice@example.com' },
        name: { label: 'Name', type: 'text', placeholder: 'Alice Cooper' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = String(credentials.email).toLowerCase().trim();
        const name = credentials.name ? String(credentials.name).trim() : email.split('@')[0];

        // Find or create the user in the database
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
    })
  );
}

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
