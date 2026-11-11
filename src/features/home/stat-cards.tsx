import { Chip } from '@heroui/react';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { Money } from '@/components/ui/money';
import { formatVnd } from '@/lib/format';

import { lastRangeLabel, spentDelta } from './stats';
import { ZaloCard } from './zalo-card';

type StatCardsProps = {
  today: string;
  zaloLinked: boolean;
  summary: { spent: number; spentLastSameRange: number; income: number };
};

const CARD =
  'bg-card border-subtle rounded-card flex flex-col gap-1.5 border px-[18px] py-4 shadow-sm';

export async function StatCards({
  today,
  summary,
  zaloLinked,
}: StatCardsProps) {
  const t = await getTranslations('home');
  const format = await getFormatter();
  const month = format.dateTime(new Date(`${today}T00:00:00+07:00`), {
    month: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  const delta = spentDelta(summary.spent, summary.spentLastSameRange);
  const remaining = summary.income - summary.spent;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
      <div className={CARD}>
        <div className="type-overline text-subtle">{t('spent', { month })}</div>
        <Money
          amount={summary.spent}
          className="text-strong text-[25px] font-medium tracking-[-0.02em]"
        />
        {delta ? (
          <div className="type-caption text-muted flex items-center gap-1.5">
            <Chip
              size="sm"
              variant="soft"
              color={
                delta.direction === 'up'
                  ? 'danger'
                  : delta.direction === 'down'
                    ? 'success'
                    : 'default'
              }
            >
              {delta.direction === 'up'
                ? '↑ '
                : delta.direction === 'down'
                  ? '↓ '
                  : ''}
              {delta.percent}%
            </Chip>
            <span>{t('vsRange', { range: lastRangeLabel(today) })}</span>
          </div>
        ) : null}
        <Link
          href="/analyze"
          className="type-caption text-accent-text mt-auto self-start hover:underline"
        >
          {t('viewAnalytics')}
        </Link>
      </div>
      <div className={CARD}>
        <div className="type-overline text-subtle">{t('income')}</div>
        <Money
          amount={summary.income}
          className="text-success-text text-[25px] font-medium tracking-[-0.02em]"
        />
        <div className="type-caption text-muted">
          {t.rich('remaining', {
            value: formatVnd(remaining),
            amount: (chunks) => (
              <span
                className={`font-mono ${remaining < 0 ? 'text-danger-text' : 'text-body'}`}
              >
                {chunks}
              </span>
            ),
          })}
        </div>
      </div>
      <ZaloCard linked={zaloLinked} />
    </div>
  );
}
