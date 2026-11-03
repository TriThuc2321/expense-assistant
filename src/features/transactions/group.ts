import type { TxView } from '@/server/services/transactions';

export function matchesSearch(tx: TxView, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [tx.note, tx.store, tx.category.name, tx.category.parentName].some(
    (field) => field?.toLowerCase().includes(needle),
  );
}

export function groupByDate(
  txs: TxView[],
): { date: string; items: TxView[]; outTotal: number }[] {
  const groups: { date: string; items: TxView[]; outTotal: number }[] = [];
  for (const tx of txs) {
    let group = groups[groups.length - 1];
    if (group?.date !== tx.date) {
      group = { date: tx.date, items: [], outTotal: 0 };
      groups.push(group);
    }
    group.items.push(tx);
    if (tx.type === 'out') group.outTotal += tx.amount;
  }
  return groups;
}
