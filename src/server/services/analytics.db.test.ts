import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { categoryBreakdown, periodSummary, trend } from './analytics';
import { createCategory, ensureDefaultCategories } from './categories';
import { createTransaction, softDeleteTransaction } from './transactions';

beforeEach(resetDb);

const OCT = { from: '2026-10-01', to: '2026-10-31' };
const SEP = { from: '2026-09-01', to: '2026-09-30' };

async function setup() {
  const u = await createTestUser();
  await ensureDefaultCategories(u.id, LOCALE.VI);
  const cats = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, u.id));
  const inn = cats.find((c) => c.type === 'in')!;
  const p = await createCategory(u.id, { name: 'Parent P', parentId: null });
  const c1 = await createCategory(u.id, { name: 'C1', parentId: p.id });
  const c2 = await createCategory(u.id, { name: 'C2', parentId: p.id });
  const add = (
    categoryId: string,
    amount: number,
    date: string,
    type: 'in' | 'out' = 'out',
  ) =>
    createTransaction(u.id, {
      type,
      amount,
      categoryId,
      store: null,
      note: null,
      date,
    });
  return { u, inn, p, c1, c2, add };
}

describe('periodSummary', () => {
  it('sums income and expense for both ranges, skipping deleted rows', async () => {
    const { u, inn, c1, add } = await setup();
    await add(c1.id, 100000, '2026-10-05');
    await add(c1.id, 50000, '2026-09-05');
    await add(inn.id, 1000000, '2026-10-01', 'in');
    const gone = await add(c1.id, 999000, '2026-10-06');
    await softDeleteTransaction(u.id, gone.id);

    expect(await periodSummary(u.id, OCT, SEP)).toEqual({
      income: 1000000,
      expense: 100000,
      prevIncome: 0,
      prevExpense: 50000,
    });
  });

  it('splits month and year boundaries', async () => {
    const { u, c1, add } = await setup();
    await add(c1.id, 1, '2026-10-31');
    await add(c1.id, 2, '2026-11-01');
    await add(c1.id, 4, '2025-12-31');
    await add(c1.id, 8, '2026-01-01');
    const nov = { from: '2026-11-01', to: '2026-11-30' };
    expect((await periodSummary(u.id, OCT, nov)).expense).toBe(1);
    expect((await periodSummary(u.id, OCT, nov)).prevExpense).toBe(2);
    const y2025 = { from: '2025-01-01', to: '2025-12-31' };
    const y2026 = { from: '2026-01-01', to: '2026-12-31' };
    expect(await periodSummary(u.id, y2026, y2025)).toMatchObject({
      expense: 11,
      prevExpense: 4,
    });
  });

  it('excludes future-dated transactions past the range end', async () => {
    const { u, c1, add } = await setup();
    await add(c1.id, 10, '2026-11-05');
    await add(c1.id, 99, '2026-11-20');
    const range = { from: '2026-11-01', to: '2026-11-11' };
    expect((await periodSummary(u.id, range, OCT)).expense).toBe(10);
    const rows = await categoryBreakdown(u.id, 'out', range);
    expect(rows[0].total).toBe(10);
  });
});

describe('categoryBreakdown', () => {
  it('folds children into the parent and keeps the parent itself', async () => {
    const { u, p, c1, c2, add } = await setup();
    await add(c1.id, 30000, '2026-10-02');
    await add(c2.id, 20000, '2026-10-03');
    await add(p.id, 10000, '2026-10-04');

    const rows = await categoryBreakdown(u.id, 'out', OCT);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: p.id,
      name: 'Parent P',
      icon: p.icon,
      color: p.color,
      total: 60000,
    });
    expect(rows[0].children).toEqual([
      { id: c1.id, name: 'C1', total: 30000, isSelf: false },
      { id: c2.id, name: 'C2', total: 20000, isSelf: false },
      { id: p.id, name: 'Parent P', total: 10000, isSelf: true },
    ]);
  });

  it('has no itself row when all spending is on one child', async () => {
    const { u, c1, add } = await setup();
    await add(c1.id, 40000, '2026-10-02');
    const [row] = await categoryBreakdown(u.id, 'out', OCT);
    expect(row.children).toEqual([
      { id: c1.id, name: 'C1', total: 40000, isSelf: false },
    ]);
  });

  it('has no children when only the parent itself was used', async () => {
    const { u, p, add } = await setup();
    await add(p.id, 5000, '2026-10-02');
    const [row] = await categoryBreakdown(u.id, 'out', OCT);
    expect(row.children).toEqual([]);
  });

  it('sorts parents by total and filters by type', async () => {
    const { u, inn, c1, add } = await setup();
    const q = await createCategory(u.id, { name: 'Q', parentId: null });
    await add(c1.id, 100, '2026-10-02');
    await add(q.id, 500, '2026-10-02');
    await add(inn.id, 7, '2026-10-02', 'in');

    const out = await categoryBreakdown(u.id, 'out', OCT);
    expect(out.map((r) => r.name)).toEqual(['Q', 'Parent P']);
    const income = await categoryBreakdown(u.id, 'in', OCT);
    expect(income.map((r) => r.total)).toEqual([7]);
  });
});

describe('trend', () => {
  it('zero-fills the axis and ignores rows past the range', async () => {
    const { u, inn, c1, add } = await setup();
    await add(c1.id, 10, '2026-11-03');
    await add(inn.id, 20, '2026-11-03', 'in');
    await add(c1.id, 99, '2026-11-20');
    const points = await trend(
      u.id,
      { from: '2026-11-01', to: '2026-11-11' },
      { from: '2026-11-01', to: '2026-11-30' },
      'day',
    );
    expect(points).toHaveLength(30);
    expect(points[2]).toEqual({ key: '2026-11-03', income: 20, expense: 10 });
    expect(points[19]).toEqual({ key: '2026-11-20', income: 0, expense: 0 });
  });

  it('buckets by month', async () => {
    const { u, c1, add } = await setup();
    await add(c1.id, 1, '2026-03-01');
    await add(c1.id, 2, '2026-03-31');
    const year = { from: '2026-01-01', to: '2026-12-31' };
    const points = await trend(u.id, year, year, 'month');
    expect(points).toHaveLength(12);
    expect(points[2]).toEqual({ key: '2026-03', income: 0, expense: 3 });
  });
});
