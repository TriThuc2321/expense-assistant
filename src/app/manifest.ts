import type { MetadataRoute } from 'next';

import { getLocale, getTranslations } from 'next-intl/server';

const BRAND_NAVY = '#13182a';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [t, locale] = await Promise.all([
    getTranslations('common'),
    getLocale(),
  ]);

  return {
    id: '/',
    name: t('appName'),
    short_name: t('appName'),
    description: t('description'),
    lang: locale,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: BRAND_NAVY,
    theme_color: BRAND_NAVY,
    categories: ['finance', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
