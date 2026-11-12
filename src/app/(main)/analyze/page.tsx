import { getTranslations } from 'next-intl/server';

import { CategoryBreakdown } from '@/features/analyze/category-breakdown';
import { EmptyState } from '@/features/analyze/empty-state';
import { PeriodNav, TypeToggle } from '@/features/analyze/period-nav';
import { parseAnalyzeParams } from '@/features/analyze/search-params';
import { SummaryCards } from '@/features/analyze/summary-cards';
import { TrendChart } from '@/features/analyze/trend-chart';
import { todayVn } from '@/lib/dates';
import { requireSession } from '@/server/auth/session';
import {
  categoryBreakdown,
  periodSummary,
  trend,
} from '@/server/services/analytics';

export default async function AnalyzePage(props: PageProps<'/analyze'>) {
  const { user } = await requireSession();
  const today = todayVn();
  const params = parseAnalyzeParams(await props.searchParams, today);
  const bucket = params.view === 'month' ? 'day' : 'month';

  const [t, summary, rows, points] = await Promise.all([
    getTranslations('analyze'),
    periodSummary(user.id, params.range, params.prev),
    categoryBreakdown(user.id, params.type, params.range),
    trend(user.id, params.range, params.axis, bucket),
  ]);

  const year = params.p.slice(0, 4);
  const periodLabel =
    params.view === 'month'
      ? t('monthLabel', { month: Number(params.p.slice(5, 7)), year })
      : t('yearLabel', { year });
  const empty = summary.income + summary.expense === 0;
  const { view, p } = params;

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-4">
      <h1 className="type-h2 text-strong">{t('title')}</h1>
      <PeriodNav params={params} today={today} />
      {empty ? (
        <EmptyState period={periodLabel} />
      ) : (
        <>
          <SummaryCards summary={summary} params={params} today={today} />
          <TypeToggle params={params} />
          <div className="wide:grid wide:grid-cols-2 wide:items-start flex flex-col gap-4">
            <CategoryBreakdown
              rows={rows}
              type={params.type}
              view={view}
              p={p}
            />
            <TrendChart
              type={params.type}
              points={points}
              bucket={bucket}
              currentKey={
                params.isCurrent
                  ? view === 'month'
                    ? today
                    : today.slice(0, 7)
                  : null
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('analyze') };
}
