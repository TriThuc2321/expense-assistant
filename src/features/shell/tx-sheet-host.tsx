'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { ResponsiveSheet } from '@/components/ui/responsive-sheet';
import { useToast } from '@/components/ui/toast';

const TX_PARAM = 'tx';

function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function useOpenNewTx(): () => void {
  const router = useRouter();
  const pathname = usePathname();

  return () => {
    // Read at press time so callers don't need useSearchParams (and a Suspense boundary).
    const params = new URLSearchParams(window.location.search);
    params.set(TX_PARAM, 'new');
    router.push(withQuery(pathname, params), { scroll: false });
  };
}

export function TxSheetHost() {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tx = searchParams.get(TX_PARAM);

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(TX_PARAM);
    router.replace(withQuery(pathname, params), { scroll: false });
  };

  return (
    <ResponsiveSheet
      isOpen={tx !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={tx === 'new' ? t('tx.addTitle') : t('tx.editTitle')}
      footer={
        <>
          <Button variant="secondary" onPress={close}>
            {t('common.cancel')}
          </Button>
          {/* Temporary toast trigger for Phase 1 verification; Phase 2 removes it. */}
          <Button
            onPress={() =>
              toast.show({ title: t('tx.added'), onUndo: () => {} })
            }
          >
            Thử toast
          </Button>
        </>
      }
    >
      <p className="type-caption text-subtle">Phase 2</p>
    </ResponsiveSheet>
  );
}
