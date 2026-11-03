import { describe, expect, it } from 'vitest';

import type { CategoryNode } from '@/server/services/categories';

import { aiCategoryOptions, normalizeAiDate } from './categories';

function node(
  id: string,
  name: string,
  type: 'out' | 'in',
  children: { id: string; name: string }[] = [],
): CategoryNode {
  return {
    id,
    name,
    type,
    parentId: null,
    txCount: 0,
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      type,
      parentId: id,
      txCount: 0,
    })),
  } as unknown as CategoryNode;
}

describe('aiCategoryOptions', () => {
  it('lists children and childless roots only', () => {
    const options = aiCategoryOptions([
      node('food', 'Ăn uống', 'out', [{ id: 'pho', name: 'Phở' }]),
      node('salary', 'Lương', 'in'),
    ]);
    expect(options).toEqual([
      { id: 'pho', name: 'Phở', parentName: 'Ăn uống', type: 'out' },
      { id: 'salary', name: 'Lương', parentName: null, type: 'in' },
    ]);
  });
});

describe('normalizeAiDate', () => {
  it('keeps past dates and replaces future/invalid ones with today', () => {
    const today = '2026-10-14';
    expect(normalizeAiDate('2026-10-13', today)).toBe('2026-10-13');
    expect(normalizeAiDate('2026-10-14', today)).toBe(today);
    expect(normalizeAiDate('2026-10-15', today)).toBe(today);
    expect(normalizeAiDate('2026-02-30', today)).toBe(today);
    expect(normalizeAiDate('hôm qua', today)).toBe(today);
    expect(normalizeAiDate(null, today)).toBe(today);
    expect(normalizeAiDate(undefined, today)).toBe(today);
  });
});
