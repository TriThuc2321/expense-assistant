export enum LOCALE {
  EN = 'en',
  VI = 'vi',
}

export const LOCALES = [LOCALE.EN, LOCALE.VI] as const;
export const DEFAULT_LOCALE = LOCALE.EN;
export const LOCALE_COOKIE = 'NEXT_LOCALE';
