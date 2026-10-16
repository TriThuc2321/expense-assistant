import type { Metadata } from 'next';

import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { Inter } from 'next/font/google';

import './globals.css';
import { ThemeProviders } from '@/providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
});

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProviders>{children}</ThemeProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: {
    template: '%s | TH Expense',
    default: 'TH Expense',
  },
  description: 'TH Expense',
  openGraph: {
    title: {
      template: '%s | TH Expense',
      default: 'TH Expense',
    },
    description: 'TH Expense Dashboard',
    images: ['/images/logo.jpeg'],
  },
};
