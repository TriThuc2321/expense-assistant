import { describe, expect, it } from 'vitest';

import { addDays } from './dates';
import { isQuestion, parseQuick } from './parse-quick';

const T = '2026-10-14';

describe('parseQuick', () => {
  it('parses the spec examples', () => {
    expect(parseQuick('ăn phở 45k', T)).toMatchObject({
      type: 'out',
      amount: 45000,
      categorySlug: 'food.breakfast',
      date: '2026-10-14',
      confidence: 'high',
    });
    expect(parseQuick('grab 32k hôm qua', T)).toMatchObject({
      type: 'out',
      amount: 32000,
      categorySlug: 'move.grab',
      store: 'Grab',
      date: '2026-10-13',
    });
    expect(parseQuick('trà sữa 55k ở Phúc Long', T)).toMatchObject({
      amount: 55000,
      categorySlug: 'food.coffee',
      store: 'Phúc Long',
    });
    expect(parseQuick('nhận lương 25tr', T)).toMatchObject({
      type: 'in',
      amount: 25_000_000,
      categorySlug: 'income.salary',
    });
    expect(parseQuick('1,5tr', T)).toMatchObject({
      amount: 1_500_000,
      categorySlug: 'shop.goods',
      confidence: 'low',
    });
  });

  it('maps root-only hits to the first child', () => {
    expect(parseQuick('ăn uống 100k', T)?.categorySlug).toBe('food.breakfast');
  });

  it('overrides to income.other on income words', () => {
    expect(parseQuick('hoàn tiền shopee 200k', T)).toMatchObject({
      type: 'in',
      categorySlug: 'income.other',
    });
  });

  it('returns null without a usable amount', () => {
    expect(parseQuick('ăn phở', T)).toBeNull();
    expect(parseQuick('ăn phở 0k', T)).toBeNull();
  });

  it('parses dotted thousand separators', () => {
    expect(parseQuick('cà phê 45.000', T)?.amount).toBe(45000);
    expect(parseQuick('tiền nhà 1.500.000', T)?.amount).toBe(1_500_000);
  });

  it('title-cases Vietnamese store names', () => {
    expect(parseQuick('trà sữa 55k ở phúc long', T)?.store).toBe('Phúc Long');
  });

  it('crosses year boundaries for hôm qua', () => {
    expect(parseQuick('grab 20k hôm qua', '2026-01-01')?.date).toBe(
      '2025-12-31',
    );
  });

  it('normalizes NFD input', () => {
    const nfd = 'phở 45k'.normalize('NFD');
    expect(nfd).not.toBe('phở 45k');
    expect(parseQuick(nfd, T)?.categorySlug).toBe('food.breakfast');
    expect(parseQuick('grab 20k hôm qua'.normalize('NFD'), T)?.date).toBe(
      addDays(T, -1),
    );
  });
});

describe('isQuestion', () => {
  it('detects questions', () => {
    expect(isQuestion('Tháng này mình tiêu bao nhiêu cho cà phê?')).toBe(true);
    expect(isQuestion('ăn phở 45k')).toBe(false);
  });

  it('normalizes NFD input', () => {
    expect(isQuestion('tiêu hết bao nhiêu 5'.normalize('NFD'))).toBe(true);
    expect(isQuestion('tiêu hết 5k'.normalize('NFD'))).toBe(true);
  });
});

describe('parseQuick amount selection', () => {
  const TODAY = '2026-11-05';
  const amount = (text: string) => parseQuick(text, TODAY)?.amount;

  it('prefers the number with a unit over a leading quantity', () => {
    expect(amount('2 ly cà phê 45k')).toBe(45_000);
    expect(amount('3 tô phở 1,5tr')).toBe(1_500_000);
  });

  it('keeps the quantity in the note and removes only the amount', () => {
    expect(parseQuick('2 ly cà phê 45k', TODAY)?.note).toBe('2 ly cà phê');
  });

  it('takes the largest number when none has a unit', () => {
    expect(amount('2 ly cà phê 45.000')).toBe(45_000);
    expect(amount('2 ly cà phê 45')).toBe(45_000);
  });

  it('does not read the start of a word as a unit', () => {
    expect(amount('3 kg thịt 50k')).toBe(50_000);
    expect(amount('3 trứng 20k')).toBe(20_000);
    expect(amount('3 kg thịt')).toBe(3_000);
  });

  it('still accepts a unit directly followed by more digits', () => {
    expect(amount('xe máy 5tr2')).toBe(5_000_000);
  });

  it('reads repeated commas as thousands separators', () => {
    expect(amount('1,500,000 tiền nhà')).toBe(1_500_000);
    expect(amount('tiền nhà 12,500,000')).toBe(12_500_000);
    expect(parseQuick('1,500,000 tiền nhà', TODAY)?.note).toBe('Tiền nhà');
  });

  it('keeps a single comma working as before', () => {
    expect(amount('phở 1,5tr')).toBe(1_500_000);
    expect(amount('phở 1,250tr')).toBe(1_250_000);
    expect(amount('phở 1,500')).toBe(1_500);
    expect(amount('phở 100,000')).toBe(100_000);
  });

  it('keeps the first of two amounts with units', () => {
    expect(amount('cơm 50k tiền tip 10k')).toBe(50_000);
  });
});
