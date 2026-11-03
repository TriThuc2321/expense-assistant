import type { TxView } from '@/server/services/transactions';

// Typed (NFD) and stored (NFC) Vietnamese must compare equal.
function fold(s: string): string {
  return s.normalize('NFC').toLowerCase();
}

export function matchesSearch(tx: TxView, q: string): boolean {
  const needle = fold(q.trim());
  if (!needle) return true;
  return [tx.note, tx.store, tx.category.name, tx.category.parentName].some(
    (field) => field && fold(field).includes(needle),
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
