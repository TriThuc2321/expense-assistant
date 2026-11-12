'use client';

import { Button, cn } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import type { TxType } from '@/lib/types';
import type { CategoryTotal } from '@/server/services/analytics';

import { CategoryTile } from '@/components/ui/category-tile';
import { Money } from '@/components/ui/money';

import type { AnalyzeView } from './search-params';

import { shareOf, topWithOther } from './compute';
import { txHref } from './links';

const OTHER_FILL = 'var(--border-strong)';

function sliceFill(color: string | null): string {
  return color ? `var(--cat-${color})` : OTHER_FILL;
}

export function CategoryBreakdown({
  rows,
  type,
  view,
  p,
}: {
  rows: CategoryTotal[];
  type: TxType;
  view: AnalyzeView;
  p: string;
}) {
  const t = useTranslations('analyze');
  const [open, setOpen] = useState<string | null>(null);
  const sum = rows.reduce((s, r) => s + r.total, 0);
  const slices = topWithOther(rows).map((s) =>
    s.id === 'other' ? { ...s, name: t('other') } : s,
  );

  return (
    <section className="bg-card border-subtle rounded-card flex flex-col gap-4 border p-4 shadow-sm">
      <h2 className="type-h4 text-strong">{t('byCategory')}</h2>

      {rows.length === 0 ? (
        <p className="type-body-sm text-muted py-8 text-center">
          {type === 'out' ? t('noExpense') : t('noIncome')}
        </p>
      ) : (
        <>
          <div className="relative mx-auto h-[200px] w-full max-w-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="total"
                  nameKey="name"
                  innerRadius="64%"
                  outerRadius="92%"
                  paddingAngle={slices.length > 1 ? 1.5 : 0}
                  stroke="none"
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.id} fill={sliceFill(s.color)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="type-caption text-subtle">{t('total')}</span>
              <Money
                amount={sum}
                className="text-strong text-[17px] font-medium"
              />
            </div>
          </div>

          <ul className="flex flex-col">
            {rows.map((row) => {
              const expanded = open === row.id;
              const share = shareOf(row.total, sum);
              return (
                <li
                  key={row.id}
                  className="border-subtle border-t first:border-t-0"
                >
                  <div className="flex items-center gap-3 py-2.5">
                    <CategoryTile icon={row.icon} color={row.color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="type-body-sm text-strong flex-1 truncate">
                          {row.name}
                        </span>
                        <Money
                          amount={row.total}
                          className="type-body-sm text-strong"
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="bg-hover h-1.5 flex-1 overflow-hidden rounded-full">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${share}%`,
                              background: sliceFill(row.color),
                            }}
                          />
                        </div>
                        <span className="type-caption text-muted w-9 text-right">
                          {share}%
                        </span>
                      </div>
                    </div>
                    {row.children.length > 0 ? (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-expanded={expanded}
                        aria-label={t('showSubcategories', { name: row.name })}
                        onPress={() => setOpen(expanded ? null : row.id)}
                      >
                        <ChevronDown
                          size={16}
                          strokeWidth={1.75}
                          className={cn(
                            'transition-transform',
                            expanded && 'rotate-180',
                          )}
                        />
                      </Button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <ul className="mb-2 ml-[50px] flex flex-col gap-1">
                      {row.children.map((c) => (
                        <li
                          key={`${c.id}-${c.isSelf}`}
                          className="flex items-center gap-2"
                        >
                          {c.isSelf ? (
                            <span className="type-body-sm text-muted flex-1 italic">
                              {t('itself')}
                            </span>
                          ) : (
                            <Link
                              href={txHref(view, p, c.id)}
                              className="type-body-sm text-body flex-1 truncate hover:underline"
                            >
                              {c.name}
                            </Link>
                          )}
                          <Money
                            amount={c.total}
                            className="type-caption text-muted"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Link
                    href={txHref(view, p, row.id)}
                    className="type-caption text-accent-text mb-2 ml-[50px] inline-block hover:underline"
                  >
                    {t('viewTransactions')}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
