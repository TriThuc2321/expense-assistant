import { Chip } from '@heroui/react';
import { getTranslations } from 'next-intl/server';

import type { PeriodSummary } from '@/server/services/analytics';

import { Money } from '@/components/ui/money';
import { lastRangeLabel, spentDelta } from '@/features/home/stats';

import type { AnalyzeParams } from './search-params';

export const CARD =
  'bg-card border-subtle rounded-card flex flex-col gap-1.5 border px-[18px] py-4 shadow-sm';

function DeltaChip({
  current,
  previous,
  upIsGood,
}: {
  current: number;
  previous: number;
  upIsGood: boolean;
}) {
  const delta = spentDelta(current, previous);
  if (!delta) return <span className="text-muted">—</span>;
  const good =
    delta.direction === 'flat' ? null : (delta.direction === 'up') === upIsGood;
  return (
    <Chip
      size="sm"
      variant="soft"
      color={good === null ? 'default' : good ? 'success' : 'danger'}
    >
      {delta.direction === 'up' ? '↑ ' : delta.direction === 'down' ? '↓ ' : ''}
      {delta.percent}%
    </Chip>
  );
}

export async function SummaryCards({
  summary,
  params,
  today,
}: {
  summary: PeriodSummary;
  params: AnalyzeParams;
  today: string;
}) {
  const t = await getTranslations('analyze');
  const prevYear = String(Number(params.p.slice(0, 4)) - 1);
  const caption = params.isCurrent
    ? params.view === 'month'
      ? t('vsSameRange', { range: lastRangeLabel(today) })
      : t('vsSameRangeYear', { year: prevYear })
    : params.view === 'month'
      ? t('vsPrevMonth')
      : t('vsPrevYear', { year: prevYear });
  const net = summary.income - summary.expense;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
      <div className={CARD}>
        <div className="type-overline text-subtle">{t('income')}</div>
        <Money
          amount={summary.income}
          className="text-success-text text-[25px] font-medium tracking-[-0.02em]"
        />
        <div className="type-caption text-muted flex items-center gap-1.5">
          <DeltaChip
            current={summary.income}
            previous={summary.prevIncome}
            upIsGood
          />
          <span>{caption}</span>
        </div>
      </div>
      <div className={CARD}>
        <div className="type-overline text-subtle">{t('expense')}</div>
        <Money
          amount={summary.expense}
          className="text-strong text-[25px] font-medium tracking-[-0.02em]"
        />
        <div className="type-caption text-muted flex items-center gap-1.5">
          <DeltaChip
            current={summary.expense}
            previous={summary.prevExpense}
            upIsGood={false}
          />
          <span>{caption}</span>
        </div>
      </div>
      <div className={CARD}>
        <div className="type-overline text-subtle">{t('net')}</div>
        <Money
          amount={net}
          className={`text-[25px] font-medium tracking-[-0.02em] ${net < 0 ? 'text-danger-text' : 'text-strong'}`}
        />
      </div>
    </div>
  );
}
