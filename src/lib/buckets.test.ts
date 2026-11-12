import { describe, expect, it } from 'vitest';

import { fillBuckets } from './buckets';

describe('fillBuckets', () => {
  it('fills every day of the axis', () => {
    const points = fillBuckets(
      [{ key: '2026-02-10', income: 0, expense: 5 }],
      { from: '2026-02-01', to: '2026-02-28' },
      'day',
    );
    expect(points).toHaveLength(28);
    expect(points[0].key).toBe('2026-02-01');
    expect(points[27].key).toBe('2026-02-28');
    expect(points[9]).toEqual({ key: '2026-02-10', income: 0, expense: 5 });
    expect(points.filter((p) => p.expense || p.income)).toHaveLength(1);
  });
  it('fills every month of a year', () => {
    const points = fillBuckets(
      [],
      { from: '2026-01-01', to: '2026-12-31' },
      'month',
    );
    expect(points.map((p) => p.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
  });
  it('drops rows outside the axis', () => {
    const points = fillBuckets(
      [{ key: '2026-03-01', income: 9, expense: 9 }],
      { from: '2026-02-01', to: '2026-02-28' },
      'day',
    );
    expect(points.every((p) => p.income === 0 && p.expense === 0)).toBe(true);
  });
});
