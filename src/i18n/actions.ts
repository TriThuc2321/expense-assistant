'use server';

import { cookies } from 'next/headers';

import type { Locale } from '@/i18n';

import { LOCALES, LOCALE_COOKIE } from '@/constants/locale';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function setUserLocale(locale: Locale) {
  if (!LOCALES.includes(locale)) return;

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: 'lax',
  });
}
