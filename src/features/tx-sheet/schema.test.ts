import { describe, expect, it } from 'vitest';

import { formatAmountText, parseAmountText, txInputSchema } from './schema';

const valid = {
  type: 'out',
  amount: 45000,
  categoryId: 'c1',
  store: null,
  note: null,
  date: '2026-10-14',
};

describe('parseAmountText', () => {
  it('keeps digits only', () => {
    expect(parseAmountText('45.000')).toBe(45000);
    expect(parseAmountText('abc')).toBe(0);
    expect(parseAmountText('')).toBe(0);
  });
});

describe('formatAmountText', () => {
  it('groups thousands with dots and hides zero', () => {
    expect(formatAmountText(1500000)).toBe('1.500.000');
    expect(formatAmountText(45000)).toBe('45.000');
    expect(formatAmountText(0)).toBe('');
  });
});

describe('txInputSchema', () => {
  it('accepts a valid input', () => {
    expect(txInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects amount 0 and non-integers', () => {
    expect(txInputSchema.safeParse({ ...valid, amount: 0 }).success).toBe(
      false,
    );
    expect(txInputSchema.safeParse({ ...valid, amount: 1.5 }).success).toBe(
      false,
    );
  });

  it('rejects a malformed date', () => {
    expect(
      txInputSchema.safeParse({ ...valid, date: '14/10/2026' }).success,
    ).toBe(false);
  });

  it('maps blank store and note to null and trims', () => {
    const res = txInputSchema.parse({ ...valid, store: '  ', note: ' hi ' });
    expect(res.store).toBeNull();
    expect(res.note).toBe('hi');
  });

  it('rejects text over 200 chars', () => {
    expect(
      txInputSchema.safeParse({ ...valid, note: 'a'.repeat(201) }).success,
    ).toBe(false);
  });
});
