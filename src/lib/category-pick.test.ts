import { describe, expect, it } from 'vitest';

import { type PickableCategory, pickCategoryForSlug } from './category-pick';

const cat = (
  id: string,
  slug: string | null,
  over: Partial<PickableCategory> = {},
): PickableCategory => ({
  id,
  slug,
  parentId: null,
  type: 'out',
  sortOrder: 0,
  ...over,
});

describe('pickCategoryForSlug', () => {
  it('returns the category with the slug', () => {
    const cats = [cat('a', 'food.coffee'), cat('b', 'shop.goods')];
    expect(pickCategoryForSlug(cats, 'food.coffee')).toBe('a');
  });

  it('falls back to shop.goods when the slug is missing', () => {
    const cats = [cat('b', 'shop.goods'), cat('c', null)];
    expect(pickCategoryForSlug(cats, 'food.coffee')).toBe('b');
  });

  it('falls back to the first out root by sortOrder', () => {
    const cats = [
      cat('x', null, { sortOrder: 5 }),
      cat('y', null, { sortOrder: 1 }),
      cat('z', null, { sortOrder: 0, type: 'in' }),
      cat('child', null, { sortOrder: 0, parentId: 'y' }),
    ];
    expect(pickCategoryForSlug(cats, 'food.coffee')).toBe('y');
  });

  it('returns null when there is no out root', () => {
    expect(
      pickCategoryForSlug([cat('z', null, { type: 'in' })], 'food.coffee'),
    ).toBeNull();
  });

  describe('with type', () => {
    it('skips a slug whose category type differs', () => {
      const cats = [
        cat('a', 'food.coffee'),
        cat('o', 'income.other', { type: 'in' }),
      ];
      expect(pickCategoryForSlug(cats, 'food.coffee', 'in')).toBe('o');
    });

    it('uses income.other when income.salary was deleted', () => {
      const cats = [
        cat('g', 'shop.goods'),
        cat('o', 'income.other', { type: 'in', parentId: 'r' }),
        cat('r', 'income', { type: 'in' }),
      ];
      expect(pickCategoryForSlug(cats, 'income.salary', 'in')).toBe('o');
    });

    it('falls to the first child of the first in root when both are deleted', () => {
      const cats = [
        cat('g', 'shop.goods'),
        cat('r2', null, { type: 'in', sortOrder: 2 }),
        cat('r1', null, { type: 'in', sortOrder: 1 }),
        cat('c2', null, { type: 'in', parentId: 'r1', sortOrder: 3 }),
        cat('c1', null, { type: 'in', parentId: 'r1', sortOrder: 1 }),
      ];
      expect(pickCategoryForSlug(cats, 'income.salary', 'in')).toBe('c1');
    });

    it('falls to the root when it has no children', () => {
      const cats = [cat('r1', null, { type: 'in' })];
      expect(pickCategoryForSlug(cats, 'income.salary', 'in')).toBe('r1');
    });

    it('returns null when there is no category of that type', () => {
      expect(
        pickCategoryForSlug([cat('g', 'shop.goods')], 'x', 'in'),
      ).toBeNull();
    });
  });
});
