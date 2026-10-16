import type { LOCALES } from '@/constants/locale';

export type Locale = (typeof LOCALES)[number];

export {
  DEFAULT_LOCALE,
  LOCALE,
  LOCALES,
  LOCALE_COOKIE,
} from '@/constants/locale';
