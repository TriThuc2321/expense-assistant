import type { Locale } from '@/i18n';

import { LOCALE } from '@/constants/locale';

import type { TxType } from './types';

import { addDays } from './dates';

const vndNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function formatVnd(amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${vndNumber.format(Math.abs(amount))} ₫`;
}

const shortMillions = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
});

export function formatShortVnd(amount: number): string {
  if (amount >= 1_000_000) return `${shortMillions.format(amount / 1e6)}tr`;
  return `${Math.round(amount / 1000)}k`;
}

const WEEKDAYS: Record<Locale, string[]> = {
  [LOCALE.VI]: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
  [LOCALE.EN]: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

const RELATIVE: Record<Locale, { today: string; yesterday: string }> = {
  [LOCALE.VI]: { today: 'Hôm nay', yesterday: 'Hôm qua' },
  [LOCALE.EN]: { today: 'Today', yesterday: 'Yesterday' },
};

export function dateLabel(date: string, today: string, locale: Locale): string {
  if (date === today) return RELATIVE[locale].today;
  if (date === addDays(today, -1)) return RELATIVE[locale].yesterday;
  const [y, m, d] = date.split('-').map(Number);
  const weekday = WEEKDAYS[locale][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d}/${m}`;
}

export function formatSignedVnd(amount: number, type: TxType): string {
  return `${type === 'out' ? '−' : '+'}${formatVnd(amount)}`;
}
