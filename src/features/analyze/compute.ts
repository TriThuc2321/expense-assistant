export type Slice = {
  id: string;
  name: string;
  color: string | null;
  total: number;
};

export function topWithOther(
  rows: Array<{ id: string; name: string; color: string; total: number }>,
  max = 6,
): Slice[] {
  if (rows.length <= max) return rows;
  const head = rows.slice(0, max - 1);
  const rest = rows.slice(max - 1).reduce((sum, r) => sum + r.total, 0);
  return [...head, { id: 'other', name: '', color: null, total: rest }];
}

export function shareOf(total: number, all: number): number {
  return all > 0 ? Math.round((total / all) * 100) : 0;
}
