import type { TxType } from './types';

export type PickableCategory = {
  id: string;
  slug: string | null;
  parentId: string | null;
  type: TxType;
  sortOrder: number;
};

const DEFAULT_SLUG: Record<TxType, string> = {
  out: 'shop.goods',
  in: 'income.other',
};

export function pickCategoryForSlug(
  cats: PickableCategory[],
  slug: string,
  type?: TxType,
): string | null {
  const bySlug = (s: string) => cats.find((c) => c.slug === s);
  const direct = bySlug(slug);
  if (direct && (!type || direct.type === type)) return direct.id;

  const fallbackType = type ?? 'out';
  const byDefault = bySlug(DEFAULT_SLUG[fallbackType]);
  if (byDefault && byDefault.type === fallbackType) return byDefault.id;

  const root = cats
    .filter((c) => c.parentId === null && c.type === fallbackType)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!root) return null;
  if (!type) return root.id;
  const child = cats
    .filter((c) => c.parentId === root.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)[0];
  return (child ?? root).id;
}
