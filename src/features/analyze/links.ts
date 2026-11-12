import type { AnalyzeView } from './search-params';

export function txHref(
  view: AnalyzeView,
  p: string,
  categoryId: string,
): string {
  const period =
    view === 'month' ? `period=month&ym=${p}` : `period=year&y=${p}`;
  return `/transactions?${period}&cat=${categoryId}`;
}
