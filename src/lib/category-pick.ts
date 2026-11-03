import type { TxType } from './types';

export type PickableCategory = {
  id: string;
  slug: string | null;
  parentId: string | null;
  type: TxType;
  sortOrder: number;
};

const FALLBACK_SLUG = 'shop.goods';

export function pickCategoryForSlug(
  cats: PickableCategory[],
  slug: string,
): string | null {
  const bySlug = (s: string) => cats.find((c) => c.slug === s)?.id;
  const firstOutRoot = cats
    .filter((c) => c.parentId === null && c.type === 'out')
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return bySlug(slug) ?? bySlug(FALLBACK_SLUG) ?? firstOutRoot?.id ?? null;
}
