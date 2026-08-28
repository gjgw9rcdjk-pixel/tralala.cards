import { IBM_Plex_Mono, Instrument_Serif } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
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

const title = 'Conversation Cards for Friends, Couples & Teams | Tralala';
const description = 'Conversation cards, icebreaker questions and conversation starters for friends, couples, parties and teams. Free to play, no account or setup required.';

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
  maximumScale: 1,
  viewportFit: 'cover',
};

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
