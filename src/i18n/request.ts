import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

import type { Locale } from '@/i18n';

import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE } from '@/constants/locale';

const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
