import { buttonVariants } from '@heroui/react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import type { TxView } from '@/server/services/transactions';

import { TxRow } from '@/features/transactions/tx-row';

export async function RecentList({
  txs,
  today,
}: {
  txs: TxView[];
  today: string;
}) {
  const t = await getTranslations('home');
  return (
    <section className="bg-card border-subtle rounded-card overflow-hidden border shadow-sm">
      <div className="flex items-center px-[18px] py-3.5">
        <h2 className="type-label text-strong flex-1 text-base">
          {t('recent')}
        </h2>
        <Link
          href="/transactions"
          className={buttonVariants({ size: 'sm', variant: 'ghost' })}
        >
          {t('seeAll')}
        </Link>
      </div>
      {txs.length === 0 ? (
        <p className="type-body-sm text-muted border-subtle border-t px-[18px] py-6 text-center">
          {t('recentEmpty')}
        </p>
      ) : (
        txs.map((tx) => <TxRow key={tx.id} tx={tx} today={today} />)
      )}
    </section>
  );
}
