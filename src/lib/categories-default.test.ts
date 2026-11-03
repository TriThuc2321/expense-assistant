import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORIES } from './categories-default';

describe('DEFAULT_CATEGORIES', () => {
  it('has the 7 roots in order', () => {
    expect(DEFAULT_CATEGORIES.map((c) => c.slug)).toEqual([
      'food',
      'home',
      'move',
      'shop',
      'fun',
      'health',
      'income',
    ]);
  });

  it('has 22 children whose slugs are prefixed by their root', () => {
    const children = DEFAULT_CATEGORIES.flatMap((r) =>
      r.children.map((c) => ({ root: r.slug, slug: c.slug })),
    );
    expect(children).toHaveLength(22);
    for (const c of children)
      expect(c.slug.startsWith(`${c.root}.`)).toBe(true);
  });

  it('has unique slugs', () => {
    const slugs = DEFAULT_CATEGORIES.flatMap((r) => [
      r.slug,
      ...r.children.map((c) => c.slug),
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('marks only income as type in', () => {
    expect(
      DEFAULT_CATEGORIES.filter((c) => c.type === 'in').map((c) => c.slug),
    ).toEqual(['income']);
  });

  it('has the food children vi names', () => {
    const food = DEFAULT_CATEGORIES.find((c) => c.slug === 'food')!;
    expect(food.children.map((c) => c.name.vi)).toEqual([
      'Ăn sáng',
      'Ăn trưa',
      'Ăn tối',
      'Cà phê',
    ]);
  });

  it('has non-empty vi and en names everywhere', () => {
    for (const r of DEFAULT_CATEGORIES) {
      for (const n of [r.name, ...r.children.map((c) => c.name)]) {
        expect(n.vi.length).toBeGreaterThan(0);
        expect(n.en.length).toBeGreaterThan(0);
      }
    }
  });
});
