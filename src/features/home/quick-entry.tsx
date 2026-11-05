'use client';

import { Button, Chip, InputGroup, Spinner, TextField } from '@heroui/react';
import { ImagePlus, MessageCircleQuestion, Sparkles, Zap } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Locale } from '@/i18n';
import type { CategoryNode } from '@/server/services/categories';

import { CategoryTile } from '@/components/ui/category-tile';
import { Money } from '@/components/ui/money';
import { useToast } from '@/components/ui/toast';
import {
  createQuickTxAction,
  deleteManyTxAction,
  scanReceiptAction,
} from '@/features/tx-sheet/actions';
import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';
import {
  type PickableCategory,
  pickCategoryForSlug,
} from '@/lib/category-pick';
import { dateLabel } from '@/lib/format';

import { inputState } from './input-state';
import { shrinkImage } from './shrink-image';

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
  const [scanning, setScanning] = useState(false);
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickable = useMemo(() => flatten(categories), [categories]);
  const state = useMemo(() => inputState(text, today), [text, today]);
  const question = state.kind === 'question';
  const parsed = state.kind === 'parsed' ? state.parsed : null;
  const pickedId = parsed
    ? pickCategoryForSlug(pickable, parsed.categorySlug, parsed.type)
    : null;
  const picked = pickedId ? describe(categories, pickedId) : null;
  const canSave = parsed !== null && picked !== null;
  const busy = saving || scanning;

  const showAdded = (title: string, ids: string[]) => {
    toast.show({
      title,
      onUndo: async () => {
        try {
          const undo = await deleteManyTxAction({ ids });
          if (!undo.ok) toast.show({ title: t(`errors.${undo.error}`) });
        } catch {
          toast.show({ title: t('errors.unknown') });
        }
      },
    });
  };

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
    showAdded(t('tx.added'), [res.data.id]);
  };

  const scan = async (file: File) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setScanning(true);
    let res;
    try {
      const image = await shrinkImage(file);
      if (!image) {
        toast.show({ title: t('errors.invalid_image') });
        return;
      }
      const formData = new FormData();
      formData.append('image', image);
      res = await scanReceiptAction(formData);
    } catch {
      toast.show({ title: t('errors.unknown') });
      return;
    } finally {
      inFlight.current = false;
      setScanning(false);
    }
    if (!res.ok) {
      toast.show({ title: t(`errors.${res.error}`) });
      return;
    }
    const { ids } = res.data;
    showAdded(
      ids.length === 1
        ? t('tx.added')
        : t('home.scanAdded', { count: ids.length }),
      ids,
    );
  };

  const onPickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change event.
    event.target.value = '';
    if (file) void scan(file);
  };

  const onPaste = (event: ClipboardEvent<HTMLFormElement>) => {
    const file = Array.from(event.clipboardData.files).find((f) =>
      f.type.startsWith('image/'),
    );
    if (!file) return;
    event.preventDefault();
    void scan(file);
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
      onPaste={onPaste}
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
          isDisabled={scanning}
          className="min-w-0 flex-1"
        >
          <InputGroup fullWidth>
            <InputGroup.Prefix>
              <Zap size={16} strokeWidth={1.75} aria-hidden />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder={t('home.quickPlaceholder')} />
          </InputGroup>
        </TextField>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickFile}
        />
        <Button
          type="button"
          size="lg"
          variant="secondary"
          isIconOnly
          aria-label={t('home.scanImage')}
          isDisabled={saving}
          isPending={scanning}
          onPress={() => fileInput.current?.click()}
        >
          {({ isPending }) =>
            isPending ? (
              <Spinner color="current" size="sm" />
            ) : (
              <ImagePlus size={18} strokeWidth={1.75} aria-hidden />
            )
          }
        </Button>
        <Button type="submit" size="lg" isDisabled={!canSave || busy}>
          {t('tx.save')}
        </Button>
      </div>

      {scanning ? (
        <output className="type-caption text-muted flex items-center gap-2">
          <Sparkles size={14} strokeWidth={1.75} aria-hidden />
          <span>{t('home.scanning')}</span>
        </output>
      ) : null}

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
            {parsed.confidence === 'low' ? (
              <div className="type-caption text-muted">
                {t('home.aiPicksCategory')}
              </div>
            ) : null}
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
