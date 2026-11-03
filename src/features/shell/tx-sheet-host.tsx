'use client';

import { Button, Spinner } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
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
    void getTxAction({ id: tx }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        onLoadError(res.error);
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
      setLoadedId(tx);
    });
    return () => {
      cancelled = true;
    };
  }, [tx, draft, form]);

  const onSubmit = form.handleSubmit(async (values) => {
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
        const undo = await deleteTxAction({ id });
        if (!undo.ok) showError(undo.error);
      },
    });
  });

  const onDelete = async () => {
    if (!editId) return;
    setDeleting(true);
    const res = await deleteTxAction({ id: editId });
    setDeleting(false);
    if (!res.ok) return showError(res.error);
    const id = editId;
    close();
    toast.show({
      title: t('tx.deleted'),
      onUndo: async () => {
        const undo = await restoreTxAction({ id });
        if (!undo.ok) showError(undo.error);
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
        <form id={FORM_ID} onSubmit={onSubmit}>
          <TxForm control={form.control} categories={categories} />
        </form>
      )}
    </ResponsiveSheet>
  );
}
