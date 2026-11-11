const vnDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
});

export type DateRange = { from: string; to: string };

function parse(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayVn(now: Date = new Date()): string {
  return vnDate.format(now);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parse(date);
  return fmt(Date.UTC(y, m - 1, d + n));
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function addMonths(monthStartDate: string, n: number): string {
  const [y, m] = parse(monthStartDate);
  return fmt(Date.UTC(y, m - 1 + n, 1));
}

export function monthRange(date: string): DateRange {
  const from = monthStart(date);
  return { from, to: addDays(addMonths(from, 1), -1) };
}

export function sameRangeLastMonth(today: string): DateRange {
  const prev = monthRange(addMonths(monthStart(today), -1));
  const day = Number(today.slice(8, 10));
  const lastDay = Number(prev.to.slice(8, 10));
  const to = `${prev.from.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  return { from: prev.from, to };
}

export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function sameRangeLastYear(today: string): DateRange {
  const year = Number(today.slice(0, 4)) - 1;
  const md = today.slice(5) === '02-29' ? '02-28' : today.slice(5);
  return { from: `${year}-01-01`, to: `${year}-${md}` };
}
