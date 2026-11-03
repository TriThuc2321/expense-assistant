import { getTranslations } from 'next-intl/server';

import {
  parseTxParams,
  toTxFilter,
} from '@/features/transactions/search-params';
import { TransactionsView } from '@/features/transactions/transactions-view';
import { todayVn } from '@/lib/dates';
import { requireSession } from '@/server/auth/session';
import {
  hasTransactionsBefore,
  listTransactions,
} from '@/server/services/transactions';

export default async function TransactionsPage(
  props: PageProps<'/transactions'>,
) {
  const { user } = await requireSession();
  const params = parseTxParams(await props.searchParams);
  const today = todayVn();
  const filter = toTxFilter(params, today);

  const [txs, hasMore] = await Promise.all([
    listTransactions(user.id, filter),
    params.period === 'all' && filter.from
      ? hasTransactionsBefore(user.id, filter.from, {
          categoryId: filter.categoryId,
          min: filter.min,
          max: filter.max,
          store: filter.store,
        })
      : false,
  ]);

  return (
    <TransactionsView
      txs={txs}
      today={today}
      params={params}
      hasMore={hasMore}
    />
  );
}

export async function generateMetadata() {
  const t = await getTranslations('nav');
  return { title: t('transactions') };
}
