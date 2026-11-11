import { z } from 'zod';

import type { TxFilter } from '@/server/services/transactions';

import { addMonths, monthRange, monthStart, yearRange } from '@/lib/dates';

export type TxPageParams = {
  period: 'this' | 'last' | 'all' | 'month' | 'year';
  ym?: string;
  y?: number;
  cat?: string;
  min?: number;
  max?: number;
  store?: string;
  months: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const MAX_MONTHS = 120;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function amount(v: string | undefined): number | undefined {
  if (!v?.trim()) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : undefined;
}

export function parseTxParams(sp: RawParams): TxPageParams {
  const periodRaw = first(sp.period);
  const ym = first(sp.ym);
  const y = first(sp.y);
  const monthsNum = Math.trunc(Number(first(sp.months)));
  const months = Number.isFinite(monthsNum)
    ? Math.min(Math.max(monthsNum, 1), MAX_MONTHS)
    : 1;

  const params: TxPageParams = { period: 'this', months };
  if (periodRaw === 'last' || periodRaw === 'all') params.period = periodRaw;
  else if (periodRaw === 'month' && ym && MONTH_RE.test(ym)) {
    params.period = 'month';
    params.ym = ym;
  } else if (periodRaw === 'year' && y && YEAR_RE.test(y)) {
    params.period = 'year';
    params.y = Number(y);
  }
  const cat = z.uuid().safeParse(first(sp.cat));
  if (cat.success) params.cat = cat.data;
  const min = amount(first(sp.min));
  if (min !== undefined) params.min = min;
  const max = amount(first(sp.max));
  if (max !== undefined) params.max = max;
  const store = first(sp.store)?.trim();
  if (store) params.store = store;
  return params;
}

export function toTxFilter(p: TxPageParams, today: string): TxFilter {
  const filter: TxFilter = {};
  if (p.period === 'this') {
    Object.assign(filter, monthRange(today));
  } else if (p.period === 'month' && p.ym) {
    Object.assign(filter, monthRange(`${p.ym}-01`));
  } else if (p.period === 'year' && p.y !== undefined) {
    Object.assign(filter, yearRange(p.y));
  } else if (p.period === 'last') {
    Object.assign(filter, monthRange(addMonths(monthStart(today), -1)));
  } else {
    filter.from = addMonths(monthStart(today), -(p.months - 1));
  }
  if (p.cat) filter.categoryId = p.cat;
  if (p.min !== undefined) filter.min = p.min;
  if (p.max !== undefined) filter.max = p.max;
  if (p.store) filter.store = p.store;
  return filter;
}
