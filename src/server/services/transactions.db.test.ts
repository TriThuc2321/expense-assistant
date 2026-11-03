import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { ensureDefaultCategories } from './categories';
import { ServiceError } from './errors';
import {
  type TxInput,
  createTransaction,
  getTransaction,
  hasTransactionsBefore,
  listTransactions,
  monthSummary,
  recentTransactions,
  restoreTransaction,
  softDeleteTransaction,
  updateTransaction,
} from './transactions';

beforeEach(resetDb);

async function setup() {
  const u = await createTestUser();
  await ensureDefaultCategories(u.id, LOCALE.VI);
  const cats = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, u.id));
  const out = cats.find((c) => c.type === 'out' && c.parentId !== null)!;
  const inn = cats.find((c) => c.type === 'in')!;
  return { u, cats, out, inn };
}

const input = (categoryId: string, over: Partial<TxInput> = {}): TxInput => ({
  type: 'out',
  amount: 50000,
  categoryId,
  store: null,
  note: null,
  date: '2026-10-15',
  ...over,
});

describe('transactions', () => {
  it("creates, reads and lists only the owner's transactions", async () => {
    const { u, out } = await setup();
    const other = await createTestUser();
    const tx = await createTransaction(
      u.id,
      input(out.id, { store: 'Highlands' }),
    );
    expect(tx.source).toBe('app');
    expect(tx.category.id).toBe(out.id);
    expect(tx.category.parentName).not.toBeNull();
    expect((await getTransaction(u.id, tx.id)).store).toBe('Highlands');
    expect(await listTransactions(u.id, {})).toHaveLength(1);
    expect(await listTransactions(other.id, {})).toHaveLength(0);
    await expect(getTransaction(other.id, tx.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    const upd = await updateTransaction(
      u.id,
      tx.id,
      input(out.id, { amount: 70000 }),
    );
    expect(upd.amount).toBe(70000);
    expect(await recentTransactions(u.id, 5)).toHaveLength(1);
  });

  it('rejects a category of another user or of the wrong type', async () => {
    const { u, out, inn } = await setup();
    const other = await setup();
    await expect(
      createTransaction(u.id, input(other.out.id)),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(createTransaction(u.id, input(inn.id))).rejects.toMatchObject({
      code: 'invalid_category',
    });
    await expect(createTransaction(u.id, input(out.id))).resolves.toBeTruthy();
    expect(ServiceError).toBeDefined();
  });

  it('soft-deletes and restores', async () => {
    const { u, out } = await setup();
    const tx = await createTransaction(u.id, input(out.id));
    await softDeleteTransaction(u.id, tx.id);
    expect(await listTransactions(u.id, {})).toHaveLength(0);
    await expect(getTransaction(u.id, tx.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    await restoreTransaction(u.id, tx.id);
    expect(await listTransactions(u.id, {})).toHaveLength(1);
  });

  it("cannot update, delete or restore another user's transaction", async () => {
    const { u, out } = await setup();
    const other = await setup();
    const tx = await createTransaction(u.id, input(out.id));
    await expect(
      updateTransaction(other.u.id, tx.id, input(other.out.id)),
    ).rejects.toMatchObject({ code: 'not_found' });
    await expect(
      softDeleteTransaction(other.u.id, tx.id),
    ).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(restoreTransaction(other.u.id, tx.id)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('filters by root category including children, amount range, store substring', async () => {
    const { u, cats, out } = await setup();
    const root = cats.find((c) => c.id === out.parentId)!;
    const otherChild = cats.find(
      (c) => c.type === 'out' && c.parentId && c.parentId !== root.id,
    )!;
    await createTransaction(
      u.id,
      input(out.id, { amount: 10000, store: 'Sale 50% off' }),
    );
    await createTransaction(
      u.id,
      input(out.id, { amount: 90000, store: 'Sale 500 off' }),
    );
    await createTransaction(
      u.id,
      input(otherChild.id, { amount: 30000, store: 'Zed_x' }),
    );
    expect(await listTransactions(u.id, { categoryId: root.id })).toHaveLength(
      2,
    );
    expect(await listTransactions(u.id, { categoryId: out.id })).toHaveLength(
      2,
    );
    expect(
      await listTransactions(u.id, { categoryId: otherChild.id }),
    ).toHaveLength(1);
    expect(
      await listTransactions(u.id, { min: 30000, max: 90000 }),
    ).toHaveLength(2);
    expect(await listTransactions(u.id, { store: '50%' })).toHaveLength(1);
    expect(await listTransactions(u.id, { store: 'SALE' })).toHaveLength(2);
    expect(await listTransactions(u.id, { store: 'd_x' })).toHaveLength(1);
    expect(await listTransactions(u.id, { store: 'dax' })).toHaveLength(0);
    expect(
      await listTransactions(u.id, { from: '2026-10-16', to: '2026-10-31' }),
    ).toHaveLength(0);
  });

  it('summarises month-to-date vs same range last month', async () => {
    const { u, out, inn } = await setup();
    const o = (amount: number, date: string) =>
      createTransaction(u.id, input(out.id, { amount, date }));
    await o(100, '2026-10-01');
    await o(200, '2026-10-31');
    await o(400, '2026-09-30');
    await o(800, '2026-09-15');
    await o(1600, '2026-11-01');
    await createTransaction(
      u.id,
      input(inn.id, { type: 'in', amount: 5000, date: '2026-10-20' }),
    );
    expect(await monthSummary(u.id, '2026-10-31')).toEqual({
      spent: 300,
      spentLastSameRange: 1200,
      income: 5000,
    });
    expect(await monthSummary(u.id, '2026-10-10')).toEqual({
      spent: 100,
      spentLastSameRange: 800,
      income: 5000,
    });
  });

  it('reports whether older transactions exist', async () => {
    const { u, out } = await setup();
    await createTransaction(u.id, input(out.id, { date: '2026-09-10' }));
    expect(await hasTransactionsBefore(u.id, '2026-10-01', {})).toBe(true);
    expect(await hasTransactionsBefore(u.id, '2026-09-10', {})).toBe(false);
    expect(
      await hasTransactionsBefore(u.id, '2026-10-01', { min: 999999 }),
    ).toBe(false);
  });
});
