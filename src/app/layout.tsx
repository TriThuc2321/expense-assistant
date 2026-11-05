import type { Metadata, Viewport } from 'next';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';

import './globals.css';
import { AppToaster } from '@/components/ui/toast';
import { env } from '@/configs/env';
import { SPLASH_IMAGES } from '@/lib/apple-splash';
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

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#05070f' },
  ],
  colorScheme: 'light dark',
  // Lets the installed app draw under the notch; layouts pad with safe-area insets.
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([
    getTranslations('common'),
    getLocale(),
  ]);
  const appName = t('appName');
  const title = {
    template: `%s | ${appName}`,
    default: appName,
  };
  const description = t('description');

  return {
    metadataBase: new URL(env().APP_URL),
    title,
    description,
    applicationName: appName,
    // Private app: keep every page out of search results.
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: appName,
      title,
      description,
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title, description },
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: 'black-translucent',
      startupImage: SPLASH_IMAGES,
    },
    formatDetection: { telephone: false },
  };
}
