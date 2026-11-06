import type { Metadata } from 'next';
import { Bricolage_Grotesque, Nunito, Caveat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/providers/SessionProvider';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-nunito',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-caveat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'loveall - Collaborative Event Photo Gallery',
  description:
    'One shared gallery for college events, trips, and weddings with fast browsing and AI-powered people discovery.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${nunito.variable} ${caveat.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#faf8f5] text-[#1e1e24] antialiased dark:bg-[#15151c] dark:text-[#f4f4f7] bg-pastel-glow selection:bg-pink-200 selection:text-pink-900 dark:selection:bg-pink-900 dark:selection:text-pink-100">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 relative z-10">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
