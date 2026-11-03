import { describe, expect, it } from 'vitest';

import { formatSignedVnd, formatVnd } from './format';

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
