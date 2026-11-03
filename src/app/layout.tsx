import type { Metadata } from 'next';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

import './globals.css';
import { AppToaster } from '@/components/ui/toast';
import { ThemeProviders } from '@/providers';

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
});

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="bg-app text-body flex min-h-full flex-col font-sans">
        <NextIntlClientProvider>
          <ThemeProviders>
            {children}
            <AppToaster />
          </ThemeProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: {
    template: '%s | Sổ Chi',
    default: 'Sổ Chi',
  },
  description: 'Sổ Chi',
  openGraph: {
    title: {
      template: '%s | Sổ Chi',
      default: 'Sổ Chi',
    },
    description: 'Sổ Chi',
    images: ['/images/logo.png'],
  },
};
