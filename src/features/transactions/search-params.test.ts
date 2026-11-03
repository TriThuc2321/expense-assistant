import { describe, expect, it } from 'vitest';

import { parseTxParams, toTxFilter } from './search-params';

describe('parseTxParams', () => {
  it('drops invalid values and clamps months', () => {
    const p = parseTxParams({ period: 'x', min: 'abc', months: '999' });
    expect(p).toEqual({ period: 'this', months: 120 });
    expect('min' in p).toBe(false);
  });
  it('defaults', () => {
    expect(parseTxParams({})).toEqual({ period: 'this', months: 1 });
  });
  it('keeps valid values', () => {
    const cat = '3f2b8c1e-6a4d-4b1e-9c3a-1d2e3f4a5b6c';
    expect(
      parseTxParams({
        period: 'all',
        cat,
        min: '1000',
        max: '5000',
        store: ' Phúc ',
        months: '3',
      }),
    ).toEqual({
      period: 'all',
      cat,
      min: 1000,
      max: 5000,
      store: 'Phúc',
      months: 3,
    });
  });
  it('drops a non-uuid cat and uses the first of repeated params', () => {
    expect(parseTxParams({ cat: 'nope', months: ['2', '5'] })).toEqual({
      period: 'this',
      months: 2,
    });
  });
});

describe('toTxFilter', () => {
  it('last month spans the previous calendar month', () => {
    expect(toTxFilter({ period: 'last', months: 1 }, '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });
  it('this month spans the current month', () => {
    expect(toTxFilter({ period: 'this', months: 1 }, '2026-02-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
  it('all reaches back `months` months with no upper bound', () => {
    const f = toTxFilter({ period: 'all', months: 3 }, '2026-10-14');
    expect(f.from).toBe('2026-08-01');
    expect(f.to).toBeUndefined();
  });
  it('passes field filters through', () => {
    expect(
      toTxFilter(
        { period: 'this', months: 1, cat: 'c', min: 1, max: 2, store: 's' },
        '2026-02-10',
      ),
    ).toMatchObject({ categoryId: 'c', min: 1, max: 2, store: 's' });
  });
});
