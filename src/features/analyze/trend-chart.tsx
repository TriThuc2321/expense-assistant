'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';

import type { TrendBucket, TrendPoint } from '@/lib/buckets';
import type { TxType } from '@/lib/types';

import { formatShortVnd, formatVnd } from '@/lib/format';

const FILL: Record<TxType, string> = {
  out: 'var(--viz-1)',
  in: 'var(--success-text)',
};

export function TrendChart({
  points,
  bucket,
  currentKey,
  type,
}: {
  points: TrendPoint[];
  type: TxType;
  bucket: TrendBucket;
  currentKey: string | null;
}) {
  const t = useTranslations('analyze');
  const locale = useLocale();
  const format = useFormatter();

  const tick = (key: string) => {
    if (bucket === 'day') return String(Number(key.slice(8, 10)));
    const m = Number(key.slice(5, 7));
    if (locale === 'vi') return `T${m}`;
    return format.dateTime(new Date(Date.UTC(2000, m - 1, 1)), {
      month: 'short',
      timeZone: 'UTC',
    });
  };

  return (
    <section className="bg-card border-subtle rounded-card flex flex-col gap-3 border p-4 shadow-sm">
      <h2 className="type-h4 text-strong">
        {type === 'out' ? t('trendExpense') : t('trendIncome')}
      </h2>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            barGap={1}
            margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
            <XAxis
              dataKey="key"
              tickFormatter={tick}
              tickLine={false}
              axisLine={false}
              interval={bucket === 'day' ? 'preserveStartEnd' : 0}
              minTickGap={8}
              tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-hover)' }}
              labelFormatter={(key) => tick(String(key))}
              formatter={(value) => [
                formatVnd(Number(value)),
                type === 'out' ? t('expense') : t('income'),
              ]}
              contentStyle={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey={type === 'out' ? 'expense' : 'income'}
              fill={FILL[type]}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {points.map((pt) => (
                <Cell
                  key={pt.key}
                  fillOpacity={
                    currentKey === null || pt.key === currentKey ? 1 : 0.8
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="sr-only">
        {t('trendSummary', {
          max: formatShortVnd(
            Math.max(
              0,
              ...points.map((pt) => (type === 'out' ? pt.expense : pt.income)),
            ),
          ),
        })}
      </p>
    </section>
  );
}
