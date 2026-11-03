import { sameRangeLastMonth } from '@/lib/dates';

export type Delta = { direction: 'up' | 'down' | 'flat'; percent: number };

export function spentDelta(spent: number, previous: number): Delta | null {
  if (previous <= 0) return null;
  const percent = Math.round((Math.abs(spent - previous) / previous) * 100);
  if (spent === previous) return { direction: 'flat', percent: 0 };
  return { direction: spent > previous ? 'up' : 'down', percent };
}

export function lastRangeLabel(today: string): string {
  const { from, to } = sameRangeLastMonth(today);
  return `1–${Number(to.slice(8, 10))}/${Number(from.slice(5, 7))}`;
}
