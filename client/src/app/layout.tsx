import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Providers } from './providers';
import { Navigation, Footer } from '@/components/navigation';
import './globals.css';
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const base = new URL(`${protocol}://${host}`);
  return {
    metadataBase: base,
    openGraph: {
      title: 'EventConn — Make room for a little more life.',
      description: 'Discover events worth showing up for.',
      type: 'website',
      siteName: 'EventConn',
      images: [
        {
          url: new URL('/og.png', base).href,
          width: 1731,
          height: 909,
          alt: 'EventConn — Make room for a little more life.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'EventConn — Make room for a little more life.',
      images: [new URL('/og.png', base).href],
    },
    title: { default: 'EventConn — Make room for a little more life.', template: '%s | EventConn' },
    description:
      'Discover events worth showing up for. Find your people, book your next experience, and make a memory.',
  };
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>
          <Navigation />
          <main id="main-content">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
