import { describe, expect, it } from 'vitest';

import type { TxView } from '@/server/services/transactions';

import { groupByDate, matchesSearch } from './group';

function tx(over: Partial<TxView> & { amount?: number }): TxView {
  return {
    id: Math.random().toString(),
    type: 'out',
    amount: 1000,
    date: '2026-10-14',
    store: null,
    note: null,
    source: 'app',
    receiptKey: null,
    createdAt: new Date(0),
    category: {
      id: 'c',
      name: 'Cà phê',
      parentName: 'Ăn uống',
      icon: 'coffee',
      color: '#000',
    },
    ...over,
  };
}

describe('groupByDate', () => {
  it('groups consecutive dates, keeps order, sums only out', () => {
    const a = tx({ amount: 100 });
    const b = tx({ amount: 50, type: 'in' });
    const c = tx({ amount: 200, date: '2026-10-13' });
    const groups = groupByDate([a, b, c]);
    expect(groups.map((g) => g.date)).toEqual(['2026-10-14', '2026-10-13']);
    expect(groups[0].items).toEqual([a, b]);
    expect(groups[0].outTotal).toBe(100);
    expect(groups[1].outTotal).toBe(200);
  });
  it('returns empty for empty', () => {
    expect(groupByDate([])).toEqual([]);
  });
});

describe('matchesSearch', () => {
  it('matches store case-insensitively', () => {
    expect(matchesSearch(tx({ store: 'Phúc Long' }), 'PHÚC')).toBe(true);
  });
  it('matches note, category and parent name', () => {
    expect(matchesSearch(tx({ note: 'sáng' }), 'SÁNG')).toBe(true);
    expect(matchesSearch(tx({}), 'cà ph')).toBe(true);
    expect(matchesSearch(tx({}), 'ăn uống')).toBe(true);
  });
  it('matches NFD-typed text against NFC data', () => {
    const nfd = 'phu\u0301c'.normalize('NFD');
    expect(matchesSearch(tx({ store: 'Phúc Long' }), nfd)).toBe(true);
  });
  it('rejects non-matches and accepts empty query', () => {
    expect(matchesSearch(tx({}), 'xyz')).toBe(false);
    expect(matchesSearch(tx({}), '  ')).toBe(true);
  });
});
