'use client';

import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useTxSheet } from '@/features/tx-sheet/tx-sheet-provider';

export function EmptyState({ period }: { period: string }) {
  const t = useTranslations();
  const { openNew } = useTxSheet();
  return (
    <div className="bg-card border-subtle rounded-card flex flex-col items-center gap-3 border px-6 py-12 text-center shadow-sm">
      <p className="type-body text-muted">{t('analyze.empty', { period })}</p>
      <Button onPress={() => openNew()}>
        <Plus size={18} strokeWidth={1.75} />
        {t('nav.addTransaction')}
      </Button>
    </div>
  );
}
