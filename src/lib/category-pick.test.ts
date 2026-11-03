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
});
