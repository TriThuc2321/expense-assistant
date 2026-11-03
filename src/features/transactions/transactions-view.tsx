'use client';

import {
  Button,
  Input,
  Label,
  SearchField,
  Tag,
  TagGroup,
  TextField,
  cn,
} from '@heroui/react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { Locale } from '@/i18n';
import type { TxView } from '@/server/services/transactions';

import { Money } from '@/components/ui/money';
import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';
import { dateLabel } from '@/lib/format';

import type { TxPageParams } from './search-params';

import { groupByDate, matchesSearch } from './group';
import { TxRow } from './tx-row';

type Patch = Partial<Record<keyof TxPageParams, string | undefined>>;

export function TransactionsView({
  txs,
  today,
  params,
  hasMore,
}: {
  txs: TxView[];
  today: string;
  params: TxPageParams;
  hasMore: boolean;
}) {
  const t = useTranslations('transactions');
  const tNav = useTranslations('nav');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { openNew, categories } = useTxSheet();
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const visible = useMemo(
    () => txs.filter((tx) => matchesSearch(tx, search)),
    [txs, search],
  );
  const groups = useMemo(() => groupByDate(visible), [visible]);
  const spent = visible.reduce(
    (sum, tx) => (tx.type === 'out' ? sum + tx.amount : sum),
    0,
  );

  // Read at call time so the sheet's `tx` param is preserved without useSearchParams.
  const update = (patch: Patch) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const hasFieldFilters =
    params.min !== undefined ||
    params.max !== undefined ||
    params.store !== undefined;

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-3.5">
      <header className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="type-overline text-subtle">
            {t.rich('summary', {
              count: visible.length,
              sum: () => <Money amount={spent} />,
            })}
          </div>
          <h1 className="type-h2 text-strong mt-1">{tNav('transactions')}</h1>
        </div>
        <Button variant="secondary" onPress={() => openNew()}>
          <Plus size={16} strokeWidth={1.75} />
          {t('add')}
        </Button>
      </header>

      <div className="flex gap-2">
        <SearchField
          aria-label={t('search')}
          value={search}
          onChange={setSearch}
          fullWidth
          className="min-w-0 flex-1"
        >
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t('searchPlaceholder')} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Button
          isIconOnly
          variant="secondary"
          aria-label={t('filter')}
          aria-pressed={filterOpen}
          onPress={() => setFilterOpen((open) => !open)}
          className={cn(filterOpen || hasFieldFilters ? 'bg-selected' : '')}
        >
          <SlidersHorizontal size={18} strokeWidth={1.75} />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TagGroup
          aria-label={t('period')}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[params.period]}
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            if (key === undefined) return;
            update({
              period: key === 'this' ? undefined : String(key),
              months: undefined,
            });
          }}
        >
          <TagGroup.List className="flex-wrap">
            <Tag id="this">{t('periodThis')}</Tag>
            <Tag id="last">{t('periodLast')}</Tag>
            <Tag id="all">{t('periodAll')}</Tag>
          </TagGroup.List>
        </TagGroup>
        <span
          aria-hidden
          className="mx-0.5 h-5 w-px bg-[var(--border-subtle)]"
        />
        <TagGroup
          aria-label={t('category')}
          selectionMode="single"
          selectedKeys={params.cat ? [params.cat] : []}
          onSelectionChange={(keys) => {
            const [key] = [...keys];
            update({ cat: key === undefined ? undefined : String(key) });
          }}
        >
          <TagGroup.List className="flex-wrap">
            {categories.map((root) => (
              <Tag key={root.id} id={root.id}>
                {root.name}
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
      </div>

      {filterOpen ? (
        <FilterPanel
          params={params}
          onCommit={update}
          onClear={() => {
            update({ min: undefined, max: undefined, store: undefined });
          }}
        />
      ) : null}

      {groups.length === 0 ? (
        <p className="type-body-sm text-muted px-4 py-10 text-center">
          {t('empty')}
        </p>
      ) : (
        groups.map((group) => (
          <section
            key={group.date}
            className="bg-card border-subtle rounded-card overflow-hidden border shadow-sm"
          >
            <div className="bg-inset flex items-center px-[18px] py-2.5">
              <h2 className="type-label text-strong flex-1">
                {dateLabel(group.date, today, locale)}
              </h2>
              {group.outTotal > 0 ? (
                <Money
                  amount={group.outTotal}
                  type="out"
                  className="text-muted text-xs"
                />
              ) : null}
            </div>
            {group.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} today={today} />
            ))}
          </section>
        ))
      )}

      {params.period === 'all' && hasMore ? (
        <Button
          variant="secondary"
          className="self-center"
          onPress={() => update({ months: String(params.months + 1) })}
        >
          {t('loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

// Local text state resyncs from the URL only when the URL changed by something
// other than this panel's own commit (clear, back/forward); remounting on every
// commit would steal focus from the next field.
function useCommittedField(urlValue: string) {
  const [value, setValue] = useState(urlValue);
  const [seen, setSeen] = useState(urlValue);
  const [committed, setCommitted] = useState(urlValue);
  if (urlValue !== seen) {
    setSeen(urlValue);
    if (urlValue !== committed) {
      setCommitted(urlValue);
      setValue(urlValue);
    }
  }
  const commit = (next: string, apply: (v: string | undefined) => void) => {
    if (next === committed) return;
    setCommitted(next);
    apply(next || undefined);
  };
  return { value, setValue, commit };
}

function FilterPanel({
  params,
  onCommit,
  onClear,
}: {
  params: TxPageParams;
  onCommit: (patch: Patch) => void;
  onClear: () => void;
}) {
  const t = useTranslations('transactions');
  const min = useCommittedField(params.min?.toString() ?? '');
  const max = useCommittedField(params.max?.toString() ?? '');
  const store = useCommittedField(params.store ?? '');

  const digits = (v: string) => v.replace(/\D/g, '');
  const commitMin = () => min.commit(min.value, (v) => onCommit({ min: v }));
  const commitMax = () => max.commit(max.value, (v) => onCommit({ max: v }));
  const commitStore = () =>
    store.commit(store.value.trim(), (v) => onCommit({ store: v }));

  return (
    <div className="bg-card border-subtle rounded-card grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 border p-4">
      <TextField
        value={min.value}
        onChange={(v) => min.setValue(digits(v))}
        onBlur={commitMin}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitMin();
        }}
      >
        <Label>{t('amountFrom')}</Label>
        <Input inputMode="numeric" placeholder="0" className="font-mono" />
      </TextField>
      <TextField
        value={max.value}
        onChange={(v) => max.setValue(digits(v))}
        onBlur={commitMax}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitMax();
        }}
      >
        <Label>{t('amountTo')}</Label>
        <Input
          inputMode="numeric"
          placeholder={t('noLimit')}
          className="font-mono"
        />
      </TextField>
      <TextField
        value={store.value}
        onChange={store.setValue}
        onBlur={commitStore}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitStore();
        }}
      >
        <Label>{t('store')}</Label>
        <Input placeholder={t('storePlaceholder')} />
      </TextField>
      <div className="flex items-end">
        <Button variant="ghost" onPress={onClear}>
          {t('clear')}
        </Button>
      </div>
    </div>
  );
}
