import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import {
  deleteSubcategory,
  ensureDefaultCategories,
  listCategories,
} from './categories';
import {
  type TxInput,
  createTransaction,
  getTransaction,
  listTransactions,
  monthSummary,
  recentTransactions,
  softDeleteTransaction,
  updateTransaction,
} from './transactions';

beforeEach(resetDb);

async function seed() {
  const a = await createTestUser();
  const b = await createTestUser();
  await ensureDefaultCategories(a.id, LOCALE.VI);
  const cats = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, a.id));
  const child = cats.find((c) => c.type === 'out' && c.parentId !== null)!;
  const input: TxInput = {
    type: 'out',
    amount: 50000,
    categoryId: child.id,
    store: null,
    note: null,
    date: '2026-10-15',
  };
  const tx = await createTransaction(a.id, input);
  return { a, b, child, input, tx };
}

describe('data isolation', () => {
  it("never returns another user's reads", async () => {
    const { b } = await seed();
    expect(await listTransactions(b.id, {})).toEqual([]);
    expect(await recentTransactions(b.id, 10)).toEqual([]);
    expect(await listCategories(b.id)).toEqual([]);
    expect(await monthSummary(b.id, '2026-10-20')).toEqual({
      spent: 0,
      spentLastSameRange: 0,
      income: 0,
    });
  });

  it("rejects access to another user's transaction and subcategory", async () => {
    const { b, child, input, tx } = await seed();
    await expect(getTransaction(b.id, tx.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(updateTransaction(b.id, tx.id, input)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(softDeleteTransaction(b.id, tx.id)).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(deleteSubcategory(b.id, child.id)).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});
