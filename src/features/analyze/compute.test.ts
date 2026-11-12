import { describe, expect, it } from 'vitest';

import { shareOf, topWithOther } from './compute';

const rows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `C${i}`,
    color: 'food',
    total: (n - i) * 10,
  }));

describe('topWithOther', () => {
  it('keeps six rows unchanged', () => {
    expect(topWithOther(rows(6))).toEqual(rows(6));
  });
  it('merges everything after the top five', () => {
    const slices = topWithOther(rows(8));
    expect(slices).toHaveLength(6);
    expect(slices.slice(0, 5).map((s) => s.id)).toEqual([
      'c0',
      'c1',
      'c2',
      'c3',
      'c4',
    ]);
    expect(slices[5]).toEqual({
      id: 'other',
      name: '',
      color: null,
      total: 60,
    });
  });
});

describe('shareOf', () => {
  it('rounds to an integer percent', () => {
    expect(shareOf(25, 200)).toBe(13);
  });
  it('is 0 when the whole is 0', () => {
    expect(shareOf(5, 0)).toBe(0);
  });
});
