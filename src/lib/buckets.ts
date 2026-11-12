import type { DateRange } from './dates';

import { addDays, addMonths, monthStart } from './dates';

export type TrendBucket = 'day' | 'month';
export type TrendPoint = { key: string; income: number; expense: number };

function axisKeys(axis: DateRange, bucket: TrendBucket): string[] {
  const keys: string[] = [];
  if (bucket === 'day') {
    for (let d = axis.from; d <= axis.to; d = addDays(d, 1)) keys.push(d);
  } else {
    for (let m = monthStart(axis.from); m <= axis.to; m = addMonths(m, 1))
      keys.push(m.slice(0, 7));
  }
  return keys;
}

export function fillBuckets(
  rows: TrendPoint[],
  axis: DateRange,
  bucket: TrendBucket,
): TrendPoint[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return axisKeys(axis, bucket).map(
    (key) => byKey.get(key) ?? { key, income: 0, expense: 0 },
  );
}
