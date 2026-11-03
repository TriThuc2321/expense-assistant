'use client';

import type { Control } from 'react-hook-form';

import {
  Input,
  InputGroup,
  Label,
  Tabs,
  Tag,
  TagGroup,
  TextField,
  cn,
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useController } from 'react-hook-form';

import type { TxType } from '@/lib/types';
import type { CategoryNode } from '@/server/services/categories';
import type { TxInput } from '@/server/services/transactions';

import { CategoryTile } from '@/components/ui/category-tile';

import { formatAmountText, parseAmountText } from './schema';

const MAX_AMOUNT = 1e12;

export function defaultCategoryId(
  categories: CategoryNode[],
  type: TxType,
): string {
  const root = categories.find((c) => c.type === type);
  return root ? (root.children[0]?.id ?? root.id) : '';
}

export function TxForm({
  control,
  categories,
}: {
  control: Control<TxInput>;
  categories: CategoryNode[];
}) {
  const t = useTranslations('tx');
  const { field: type } = useController({ control, name: 'type' });
  const { field: amount } = useController({ control, name: 'amount' });
  const { field: categoryId } = useController({ control, name: 'categoryId' });
  const { field: note } = useController({ control, name: 'note' });
  const { field: store } = useController({ control, name: 'store' });
  const { field: date } = useController({ control, name: 'date' });

  const roots = categories.filter((c) => c.type === type.value);
  const selectedRoot = roots.find(
    (r) =>
      r.id === categoryId.value ||
      r.children.some((c) => c.id === categoryId.value),
  );

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        selectedKey={type.value}
        onSelectionChange={(key) => {
          const next = key as TxType;
          if (next === type.value) return;
          type.onChange(next);
          categoryId.onChange(defaultCategoryId(categories, next));
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('type')}>
            <Tabs.Tab id="out">
              {t('expense')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="in">
              {t('income')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <TextField
        fullWidth
        value={formatAmountText(amount.value)}
        onChange={(v) =>
          amount.onChange(Math.min(parseAmountText(v), MAX_AMOUNT))
        }
      >
        <Label>{t('amount')}</Label>
        <InputGroup fullWidth>
          <InputGroup.Input
            inputMode="numeric"
            placeholder="0"
            className="font-mono text-lg"
          />
          <InputGroup.Suffix>₫</InputGroup.Suffix>
        </InputGroup>
      </TextField>

      <div className="flex flex-col gap-2">
        <span className="type-label text-strong">{t('category')}</span>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {roots.map((root) => {
            const selected = root.id === selectedRoot?.id;
            return (
              <button
                key={root.id}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  categoryId.onChange(root.children[0]?.id ?? root.id)
                }
                className={cn(
                  'rounded-control flex flex-col items-center gap-1.5 border px-1.5 py-2.5 transition-colors',
                  selected
                    ? 'bg-selected border-accent'
                    : 'border-subtle hover:bg-hover',
                )}
              >
                <CategoryTile icon={root.icon} color={root.color} />
                <span className="type-caption text-body line-clamp-1">
                  {root.name}
                </span>
              </button>
            );
          })}
        </div>
        {selectedRoot && selectedRoot.children.length > 0 ? (
          <TagGroup
            aria-label={t('category')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[categoryId.value]}
            onSelectionChange={(keys) => {
              const [first] = [...keys];
              if (first !== undefined) categoryId.onChange(String(first));
            }}
          >
            <TagGroup.List>
              {selectedRoot.children.map((child) => (
                <Tag key={child.id} id={child.id}>
                  {child.name}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        ) : null}
      </div>

      <TextField
        fullWidth
        value={note.value ?? ''}
        onChange={note.onChange}
        maxLength={200}
      >
        <Label>{t('note')}</Label>
        <Input />
      </TextField>
      <TextField
        fullWidth
        value={store.value ?? ''}
        onChange={store.onChange}
        maxLength={200}
      >
        <Label>{t('store')}</Label>
        <Input />
      </TextField>
      <TextField
        fullWidth
        type="date"
        value={date.value}
        onChange={date.onChange}
      >
        <Label>{t('date')}</Label>
        {/* iOS WebKit gives date inputs an intrinsic width that overrides w-full and overflows the sheet. */}
        <Input className="min-w-0 appearance-none [&::-webkit-date-and-time-value]:text-left" />
      </TextField>
    </div>
  );
}
