'use client';

import type { FormEvent } from 'react';

import { Button, Spinner } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import type { ActionErrorCode } from '@/lib/action-result';
import type { TxInput } from '@/server/services/transactions';

import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useToast } from '@/components/ui/toast';
import {
  createTxAction,
  deleteTxAction,
  getTxAction,
  restoreTxAction,
  updateTxAction,
} from '@/features/tx-sheet/actions';
import { txInputSchema } from '@/features/tx-sheet/schema';
import { TxForm, defaultCategoryId } from '@/features/tx-sheet/tx-form';
import {
  TX_PARAM,
  useTxDraft,
  useTxSheet,
  withQuery,
} from '@/features/tx-sheet/tx-sheet-provider';

const FORM_ID = 'tx-form';

export function TxSheetHost() {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { categories, today } = useTxSheet();
  const draft = useTxDraft();
  const tx = searchParams.get(TX_PARAM);

  const form = useForm<TxInput>({
    resolver: zodResolver(txInputSchema),
    defaultValues: {
      type: 'out',
      amount: 0,
      categoryId: defaultCategoryId(categories, 'out'),
      store: null,
      note: null,
      date: today,
    },
  });

  // Captured while open so the title and footer don't flip during the close animation.
  const [mode, setMode] = useState<'new' | 'edit'>('new');
  const [editId, setEditId] = useState<string | null>(null);
  if (tx !== null) {
    const nextMode = tx === 'new' ? 'new' : 'edit';
    if (nextMode !== mode) setMode(nextMode);
    const nextId = tx === 'new' ? null : tx;
    if (nextId !== editId) setEditId(nextId);
  }

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [receiptTxId, setReceiptTxId] = useState<string | null>(null);
  if (tx === null && loadedId !== null) setLoadedId(null);
  if ((tx === null || tx === 'new') && receiptTxId !== null) {
    setReceiptTxId(null);
  }
  const submitting = useRef(false);
  const loading = tx !== null && tx !== 'new' && loadedId !== tx;

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(TX_PARAM);
    router.replace(withQuery(pathname, params), { scroll: false });
  };

  const showError = (code: ActionErrorCode) =>
    toast.show({ title: t(`errors.${code}`) });

  // Effect Events keep categories/today/close out of the deps, so a refresh()
  // that re-renders the layout can't wipe what the user is typing.
  const resetNew = useEffectEvent(() => {
    form.reset({
      type: 'out',
      amount: 0,
      categoryId: defaultCategoryId(categories, 'out'),
      store: null,
      note: null,
      date: today,
      ...draft,
    });
  });
  const onLoadError = useEffectEvent((code: ActionErrorCode) => {
    showError(code);
    close();
  });

  useEffect(() => {
    if (tx === 'new') {
      resetNew();
      return;
    }
    if (tx === null) return;
    let cancelled = false;
    getTxAction({ id: tx })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          onLoadError(res.error === 'invalid_input' ? 'not_found' : res.error);
          return;
        }
        const v = res.data;
        form.reset({
          type: v.type,
          amount: v.amount,
          categoryId: v.category.id,
          store: v.store,
          note: v.note,
          date: v.date,
        });
        setReceiptTxId(v.receiptKey ? v.id : null);
        setLoadedId(tx);
      })
      .catch(() => {
        if (!cancelled) onLoadError('unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [tx, draft, form]);

  const submit = form.handleSubmit(async (values) => {
    await save(values);
  });

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // Enter in a field bypasses the disabled footer button; state lags a render, so use a ref.
    if (submitting.current) {
      e.preventDefault();
      return;
    }
    submitting.current = true;
    submit(e)
      .catch(() => showError('unknown'))
      .finally(() => {
        submitting.current = false;
      });
  };

  const save = async (values: TxInput) => {
    if (editId) {
      const res = await updateTxAction({ id: editId, ...values });
      if (!res.ok) return showError(res.error);
      close();
      toast.show({ title: t('tx.saved') });
      return;
    }
    const res = await createTxAction(values);
    if (!res.ok) return showError(res.error);
    const { id } = res.data;
    close();
    toast.show({
      title: t('tx.added'),
      onUndo: async () => {
        try {
          const undo = await deleteTxAction({ id });
          if (!undo.ok) showError(undo.error);
        } catch {
          showError('unknown');
        }
      },
    });
  };

  const onDelete = async () => {
    if (!editId) return;
    setDeleting(true);
    let res;
    try {
      res = await deleteTxAction({ id: editId });
    } catch {
      showError('unknown');
      return;
    } finally {
      setDeleting(false);
    }
    if (!res.ok) return showError(res.error);
    const id = editId;
    close();
    toast.show({
      title: t('tx.deleted'),
      onUndo: async () => {
        try {
          const undo = await restoreTxAction({ id });
          if (!undo.ok) showError(undo.error);
        } catch {
          showError('unknown');
        }
      },
    });
  };

  const amount = useWatch({ control: form.control, name: 'amount' });
  const pending = form.formState.isSubmitting || deleting;

  return (
    <ResponsiveSheet
      isOpen={tx !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={mode === 'new' ? t('tx.addTitle') : t('tx.editTitle')}
      footer={
        <>
          {mode === 'edit' ? (
            <Button
              variant="danger-soft"
              className="mr-auto"
              isDisabled={loading || pending}
              onPress={onDelete}
            >
              {t('tx.delete')}
            </Button>
          ) : null}
          <Button variant="secondary" onPress={close}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            isDisabled={loading || pending || amount === 0}
          >
            {mode === 'new' ? t('tx.add') : t('tx.save')}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {receiptTxId ? (
            <a
              href={`/api/receipts/${receiptTxId}`}
              target="_blank"
              rel="noopener"
              className="mb-4 inline-block"
            >
              {/* next/image would cache the short-lived signed redirect target */}
              {/* oxlint-disable-next-line nextjs/no-img-element */}
              <img
                src={`/api/receipts/${receiptTxId}`}
                alt={t('tx.viewReceipt')}
                width={64}
                height={64}
                className="size-16 rounded-[12px] object-cover"
              />
            </a>
          ) : null}
          <form id={FORM_ID} onSubmit={onSubmit}>
            <TxForm control={form.control} categories={categories} />
          </form>
        </>
      )}
    </ResponsiveSheet>
  );
}
