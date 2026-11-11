import type { TxType } from '@/lib/types';

import {
  type DateRange,
  addMonths,
  monthRange,
  sameRangeLastMonth,
  sameRangeLastYear,
  yearRange,
} from '@/lib/dates';

export type AnalyzeView = 'month' | 'year';

export type AnalyzeParams = {
  view: AnalyzeView;
  type: TxType;
  p: string;
  isCurrent: boolean;
  range: DateRange;
  prev: DateRange;
  axis: DateRange;
  prevP: string | null;
  nextP: string | null;
};

type RawParams = Record<string, string | string[] | undefined>;

const YEARS_BACK = 10;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^(\d{4})$/;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function resolveP(raw: string | undefined, view: AnalyzeView, today: string) {
  const currentMonth = today.slice(0, 7);
  const currentYear = today.slice(0, 4);
  const fallback = view === 'month' ? currentMonth : currentYear;
  if (!raw) return fallback;

  let p: string | undefined;
  if (MONTH_RE.test(raw)) {
    p = view === 'month' ? raw : raw.slice(0, 4);
  } else if (YEAR_RE.test(raw)) {
    if (view === 'year') p = raw;
    else p = raw === currentYear ? currentMonth : `${raw}-01`;
  }
  if (!p) return fallback;

  const floor = Number(currentYear) - YEARS_BACK;
  const tooOld = Number(p.slice(0, 4)) < floor;
  const future = view === 'month' ? p > currentMonth : p > currentYear;
  return tooOld || future ? fallback : p;
}

function shift(p: string, view: AnalyzeView, n: number): string {
  if (view === 'year') return String(Number(p) + n);
  return addMonths(`${p}-01`, n).slice(0, 7);
}

export function parseAnalyzeParams(
  sp: RawParams,
  today: string,
): AnalyzeParams {
  const view: AnalyzeView = first(sp.view) === 'year' ? 'year' : 'month';
  const type: TxType = first(sp.type) === 'in' ? 'in' : 'out';
  const p = resolveP(first(sp.p), view, today);

  const current = view === 'month' ? today.slice(0, 7) : today.slice(0, 4);
  const isCurrent = p === current;
  const axis = view === 'month' ? monthRange(`${p}-01`) : yearRange(Number(p));
  const range = isCurrent ? { from: axis.from, to: today } : axis;
  const before = shift(p, view, -1);
  const prev = isCurrent
    ? view === 'month'
      ? sameRangeLastMonth(today)
      : sameRangeLastYear(today)
    : view === 'month'
      ? monthRange(`${before}-01`)
      : yearRange(Number(before));
  const floor = Number(today.slice(0, 4)) - YEARS_BACK;

  return {
    view,
    type,
    p,
    isCurrent,
    range,
    prev,
    axis,
    prevP: Number(before.slice(0, 4)) < floor ? null : before,
    nextP: isCurrent ? null : shift(p, view, 1),
  };
}

export function analyzeHref(q: {
  view: AnalyzeView;
  p: string;
  type: TxType;
}): string {
  const sp = new URLSearchParams();
  if (q.view !== 'month') sp.set('view', q.view);
  sp.set('p', q.p);
  if (q.type !== 'out') sp.set('type', q.type);
  return `/analyze?${sp.toString()}`;
}
