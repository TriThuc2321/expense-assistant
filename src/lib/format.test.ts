import { describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';

import {
  dateLabel,
  formatShortVnd,
  formatSignedVnd,
  formatVnd,
} from './format';

describe('formatVnd', () => {
  it('groups thousands with dots and appends the dong sign', () => {
    expect(formatVnd(45000)).toBe('45.000 ₫');
    expect(formatVnd(25000000)).toBe('25.000.000 ₫');
    expect(formatVnd(0)).toBe('0 ₫');
  });
});

describe('formatSignedVnd', () => {
  it('prefixes expenses with U+2212 and income with +', () => {
    expect(formatSignedVnd(45000, 'out')).toBe('−45.000 ₫');
    expect(formatSignedVnd(45000, 'in')).toBe('+45.000 ₫');
  });
});

describe('formatVnd negatives', () => {
  it('uses U+2212 for negatives', () => {
    expect(formatVnd(-5000)).toBe('−5.000 ₫');
  });
});

describe('formatShortVnd', () => {
  it('abbreviates millions and thousands', () => {
    expect(formatShortVnd(12_900_000)).toBe('12,9tr');
    expect(formatShortVnd(25_000_000)).toBe('25tr');
    expect(formatShortVnd(450_000)).toBe('450k');
  });
});

describe('dateLabel', () => {
  it('labels relative and weekday dates per locale', () => {
    expect(dateLabel('2026-10-14', '2026-10-14', LOCALE.VI)).toBe('Hôm nay');
    expect(dateLabel('2026-10-14', '2026-10-14', LOCALE.EN)).toBe('Today');
    expect(dateLabel('2026-10-13', '2026-10-14', LOCALE.VI)).toBe('Hôm qua');
    expect(dateLabel('2026-10-13', '2026-10-14', LOCALE.EN)).toBe('Yesterday');
    expect(dateLabel('2026-10-12', '2026-10-14', LOCALE.VI)).toBe('T2, 12/10');
    expect(dateLabel('2026-10-11', '2026-10-14', LOCALE.VI)).toBe('CN, 11/10');
    expect(dateLabel('2026-10-12', '2026-10-14', LOCALE.EN)).toBe('Mon, 12/10');
    expect(dateLabel('2026-10-05', '2026-10-14', LOCALE.EN)).toBe('Mon, 5/10');
  });
});
