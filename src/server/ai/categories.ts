import type { TxType } from '@/lib/types';
import type { CategoryNode } from '@/server/services/categories';

export type AiCategory = {
  id: string;
  name: string;
  parentName: string | null;
  type: TxType;
};

export function aiCategoryOptions(nodes: CategoryNode[]): AiCategory[] {
  return nodes.flatMap((root): AiCategory[] =>
    root.children.length === 0
      ? [{ id: root.id, name: root.name, parentName: null, type: root.type }]
      : root.children.map((child) => ({
          id: child.id,
          name: child.name,
          parentName: root.name,
          type: child.type,
        })),
  );
}

export function normalizeAiDate(
  date: string | null | undefined,
  today: string,
): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return today;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  const roundTrips =
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d;
  return roundTrips && date <= today ? date : today;
}

export function categoryLines(categories: AiCategory[]): string {
  return categories
    .map((c) => {
      const label = c.parentName ? `${c.parentName} › ${c.name}` : c.name;
      return `${c.id} — ${label} (${c.type})`;
    })
    .join('\n');
}

export function categoryIds(categories: AiCategory[]): [string, ...string[]] {
  return categories.map((c) => c.id) as [string, ...string[]];
}
