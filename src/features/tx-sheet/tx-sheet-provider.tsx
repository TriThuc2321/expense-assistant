'use client';

import type { ReactNode } from 'react';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, use, useMemo, useState } from 'react';

import type { CategoryNode } from '@/server/services/categories';
import type { TxInput } from '@/server/services/transactions';

export type TxDraft = Partial<TxInput>;

export const TX_PARAM = 'tx';

export function withQuery(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

type TxSheetApi = {
  openNew: (draft?: TxDraft) => void;
  openEdit: (id: string) => void;
  categories: CategoryNode[];
  today: string;
};

const TxSheetContext = createContext<TxSheetApi | null>(null);
const TxDraftContext = createContext<TxDraft | null>(null);

export function TxSheetProvider({
  categories,
  today,
  children,
}: {
  categories: CategoryNode[];
  today: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<TxDraft | null>(null);

  const api = useMemo<TxSheetApi>(() => {
    // Read at press time so callers don't need useSearchParams (and a Suspense boundary).
    const push = (value: string) => {
      const params = new URLSearchParams(window.location.search);
      params.set(TX_PARAM, value);
      router.push(withQuery(pathname, params), { scroll: false });
    };
    return {
      openNew: (next) => {
        setDraft(next ?? null);
        push('new');
      },
      openEdit: (id) => push(id),
      categories,
      today,
    };
  }, [router, pathname, categories, today]);

  return (
    <TxSheetContext value={api}>
      <TxDraftContext value={draft}>{children}</TxDraftContext>
    </TxSheetContext>
  );
}

export function useTxSheet(): TxSheetApi {
  const ctx = use(TxSheetContext);
  if (!ctx) throw new Error('useTxSheet must be used within TxSheetProvider');
  return ctx;
}

export function useTxDraft(): TxDraft | null {
  return use(TxDraftContext);
}
