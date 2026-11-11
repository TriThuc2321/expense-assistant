import { cn } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { AnalyzeParams } from './search-params';

import { analyzeHref } from './search-params';

const SEGMENT =
  'rounded-tag px-3 py-1.5 text-[14px] font-medium transition-colors';
const ARROW =
  'rounded-control text-body hover:bg-hover inline-flex size-9 items-center justify-center';

export async function PeriodNav({
  params,
  today,
}: {
  params: AnalyzeParams;
  today: string;
}) {
  const t = await getTranslations('analyze');
  const { view, p, type } = params;
  const year = p.slice(0, 4);
  const monthP = year === today.slice(0, 4) ? today.slice(0, 7) : `${year}-01`;
  const label =
    view === 'month'
      ? t('monthLabel', { month: Number(p.slice(5, 7)), year })
      : t('yearLabel', { year });

  const arrow = (target: string | null, dir: 'prev' | 'next') => {
    const Icon = dir === 'prev' ? ChevronLeft : ChevronRight;
    const aria = dir === 'prev' ? t('previous') : t('next');
    if (!target)
      return (
        <span aria-disabled className={cn(ARROW, 'text-subtle opacity-40')}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
      );
    return (
      <Link
        href={analyzeHref({ view, p: target, type })}
        aria-label={aria}
        className={ARROW}
      >
        <Icon size={18} strokeWidth={1.75} />
      </Link>
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label={t('viewLabel')}
        className="bg-card border-subtle rounded-control flex gap-1 border p-1"
      >
        {(['month', 'year'] as const).map((v) => (
          <Link
            key={v}
            href={analyzeHref({
              view: v,
              p: v === 'month' ? monthP : year,
              type,
            })}
            aria-current={view === v ? 'page' : undefined}
            className={cn(
              SEGMENT,
              view === v
                ? 'bg-selected text-accent-text'
                : 'text-body hover:bg-hover',
            )}
          >
            {v === 'month' ? t('month') : t('year')}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-1">
        {arrow(params.prevP, 'prev')}
        <span className="type-label text-strong min-w-[120px] text-center">
          {label}
        </span>
        {arrow(params.nextP, 'next')}
      </div>
    </div>
  );
}

export async function TypeToggle({ params }: { params: AnalyzeParams }) {
  const t = await getTranslations('analyze');
  const { view, p, type } = params;
  return (
    <nav
      aria-label={t('typeLabel')}
      className="bg-card border-subtle rounded-control flex gap-1 self-start border p-1"
    >
      {(['out', 'in'] as const).map((k) => (
        <Link
          key={k}
          href={analyzeHref({ view, p, type: k })}
          scroll={false}
          aria-current={type === k ? 'page' : undefined}
          className={cn(
            SEGMENT,
            type === k
              ? 'bg-selected text-accent-text'
              : 'text-body hover:bg-hover',
          )}
        >
          {k === 'out' ? t('expense') : t('income')}
        </Link>
      ))}
    </nav>
  );
}
