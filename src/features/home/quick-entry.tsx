'use client';

import { Button, Chip, InputGroup, TextField } from '@heroui/react';
import { MessageCircleQuestion, Sparkles, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useRef, useState } from 'react';

import type { Locale } from '@/i18n';
import type { CategoryNode } from '@/server/services/categories';

import { CategoryTile } from '@/components/ui/category-tile';
import { Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import {
  createQuickTxAction,
  deleteTxAction,
} from '@/features/tx-sheet/actions';
import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';
import {
  type PickableCategory,
  pickCategoryForSlug,
} from '@/lib/category-pick';
import { dateLabel } from '@/lib/format';

import { inputState } from './input-state';

const EXAMPLES = [
  'ăn phở 45k',
  'grab 32k hôm qua',
  'trà sữa 55k ở Phúc Long',
  'nhận lương 25tr',
  'Tháng này mình tiêu bao nhiêu cho cà phê?',
];

function flatten(categories: CategoryNode[]): PickableCategory[] {
  return categories.flatMap((root) => [root, ...root.children]);
}

type PickedCategory = {
  id: string;
  name: string;
  parentName: string | null;
  icon: string;
  color: string;
};

function describe(
  categories: CategoryNode[],
  id: string,
): PickedCategory | null {
  for (const root of categories) {
    if (root.id === id) {
      return {
        id,
        name: root.name,
        parentName: null,
        icon: root.icon,
        color: root.color,
      };
    }
    const child = root.children.find((c) => c.id === id);
    if (child) {
      return {
        id,
        name: child.name,
        parentName: root.name,
        icon: child.icon,
        color: child.color,
      };
    }
  }
  return null;
}

export function QuickEntry() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const toast = useToast();
  const { openNew, categories, today } = useTxSheet();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);

  const pickable = useMemo(() => flatten(categories), [categories]);
  const state = useMemo(() => inputState(text, today), [text, today]);
  const question = state.kind === 'question';
  const parsed = state.kind === 'parsed' ? state.parsed : null;
  const pickedId = parsed
    ? pickCategoryForSlug(pickable, parsed.categorySlug, parsed.type)
    : null;
  const picked = pickedId ? describe(categories, pickedId) : null;
  const canSave = parsed !== null && picked !== null;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    // State updates lag behind a fast second Enter, so guard with a ref.
    if (!parsed || !canSave || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    let res;
    try {
      res = await createQuickTxAction({ text });
    } catch {
      toast.show({ title: t('errors.unknown') });
      return;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
    if (!res.ok) {
      toast.show({ title: t(`errors.${res.error}`) });
      return;
    }
    setText('');
    const { id } = res.data;
    toast.show({
      title: t('tx.added'),
      onUndo: async () => {
        try {
          const undo = await deleteTxAction({ id });
          if (!undo.ok) toast.show({ title: t(`errors.${undo.error}`) });
        } catch {
          toast.show({ title: t('errors.unknown') });
        }
      },
    });
  };

  const previewMeta =
    parsed && picked
      ? [
          picked.parentName
            ? `${picked.parentName} › ${picked.name}`
            : picked.name,
          parsed.store,
          dateLabel(parsed.date, today, locale),
        ]
          .filter(Boolean)
          .join(' · ')
      : '';

  return (
    <form
      onSubmit={submit}
      className="bg-card border-subtle rounded-panel flex flex-col gap-3.5 border p-5 shadow-sm"
    >
      <div className="type-overline text-accent-text flex items-center gap-2">
        <Sparkles size={16} strokeWidth={1.75} aria-hidden />
        <span>{t('home.quickTitle')}</span>
      </div>
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          aria-label={t('home.quickTitle')}
          value={text}
          onChange={setText}
          className="min-w-0 flex-1"
        >
          <InputGroup fullWidth>
            <InputGroup.Prefix>
              <Zap size={16} strokeWidth={1.75} aria-hidden />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder={t('home.quickPlaceholder')} />
          </InputGroup>
        </TextField>
        <Button type="submit" size="lg" isDisabled={!canSave || saving}>
          {t('tx.save')}
        </Button>
      </div>

      {parsed && picked ? (
        <div className="bg-inset border-subtle rounded-card flex flex-wrap items-center gap-3 border px-3.5 py-3">
          <CategoryTile icon={picked.icon} color={picked.color} />
          <div className="min-w-40 flex-1">
            <div className="flex items-center gap-2">
              <span className="type-body-sm text-strong font-medium">
                {parsed.note}
              </span>
              <Chip
                size="sm"
                variant="soft"
                color={parsed.type === 'out' ? 'accent' : 'success'}
              >
                {parsed.type === 'out' ? t('tx.expense') : t('tx.income')}
              </Chip>
            </div>
            <div className="type-caption text-subtle">{previewMeta}</div>
          </div>
          <Money
            amount={parsed.amount}
            type={parsed.type}
            className={`text-base font-medium ${parsed.type === 'out' ? 'text-strong' : ''}`}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onPress={() => {
              openNew({
                type: parsed.type,
                amount: parsed.amount,
                categoryId: picked.id,
                store: parsed.store,
                note: parsed.note,
                date: parsed.date,
              });
              setText('');
            }}
          >
            {t('home.edit')}
          </Button>
        </div>
      ) : null}

      {question ? (
        <div className="type-caption text-muted flex items-center gap-2">
          <MessageCircleQuestion size={14} strokeWidth={1.75} aria-hidden />
          <span>{t('home.askSoon')}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setText(example)}
            className="bg-inset border-subtle type-caption text-body hover:bg-hover rounded-full border px-3 py-1 transition-colors"
          >
            {example}
          </button>
        ))}
      </div>
    </form>
  );
}
