'use client';

import { MessageCircle } from 'lucide-react';
import { useLocale } from 'next-intl';

import type { Locale } from '@/i18n';
import type { TxView } from '@/server/services/transactions';

import { CategoryTile } from '@/components/ui/category-tile';
import { Money } from '@/components/ui/money';
import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';
import { dateLabel } from '@/lib/format';

export function TxRow({ tx, today }: { tx: TxView; today: string }) {
  const locale = useLocale() as Locale;
  const { openEdit } = useTxSheet();
  const { category } = tx;
  const path = category.parentName
    ? `${category.parentName} › ${category.name}`
    : category.name;
  const meta = tx.store ? `${path} · ${tx.store}` : path;

  return (
    <button
      type="button"
      onClick={() => openEdit(tx.id)}
      className="hover:bg-hover border-subtle flex w-full items-center gap-3 border-t px-[18px] py-[11px] text-left transition-colors"
    >
      <CategoryTile icon={category.icon} color={category.color} />
      <span className="min-w-0 flex-1">
        <span className="type-body-sm text-strong block truncate font-medium">
          {tx.note ?? category.name}
        </span>
        <span className="type-caption text-subtle flex items-center gap-1">
          {tx.source === 'zalo' ? (
            <MessageCircle
              size={12}
              strokeWidth={1.75}
              aria-label="Zalo"
              className="shrink-0"
            />
          ) : null}
          <span className="truncate">{meta}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          amount={tx.amount}
          type={tx.type}
          className="text-strong text-[13px] font-medium whitespace-nowrap"
        />
        <span className="type-caption text-subtle">
          {dateLabel(tx.date, today, locale)}
        </span>
      </span>
    </button>
  );
}
