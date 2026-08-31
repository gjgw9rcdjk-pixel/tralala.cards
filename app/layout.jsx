import { IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SITE_TITLE, SITE_DESCRIPTION } from '@/lib/seo';
import './globals.css';

const mono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

const serif = Instrument_Serif({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const title = SITE_TITLE;
const description = SITE_DESCRIPTION;

export const metadata = {
  metadataBase: new URL('https://tralala.cards'),
  title,
  description,
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Tralala' },
  openGraph: { title, description, url: '/', siteName: 'Tralala.cards', type: 'website' },
  twitter: { card: 'summary_large_image', title, description },
  verification: { google: 'kUKuJomOeUDd9yK4jT4OcO8cornnFeRvbjpybkz-Qt4' },
};

export const viewport = {
  themeColor: '#0c0c0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Kept as a static "en" default so every route (including the language
// routes /lt, /de, /es, /it, /pl) stays statically prerendered — a
// per-request lang here would force the whole site into dynamic rendering
// just for this one attribute. The visible text is correctly server-rendered
// per language regardless (see app/HomeBody.jsx); CardGame.jsx corrects
// document.documentElement.lang client-side within a moment of hydration.
export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${mono.variable} ${serif.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
