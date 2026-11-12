import {
  type SQL,
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { TxType } from '@/lib/types';

import { monthRange, sameRangeLastMonth } from '@/lib/dates';
import { getDb } from '@/server/db';
import { categories, transactions } from '@/server/db/schema';

import { ServiceError } from './errors';

export type TxInput = {
  type: TxType;
  amount: number;
  categoryId: string;
  store: string | null;
  note: string | null;
  date: string;
};

export type TxView = {
  id: string;
  type: TxType;
  amount: number;
  date: string;
  store: string | null;
  note: string | null;
  source: 'app' | 'zalo';
  receiptKey: string | null;
  createdAt: Date;
  category: {
    id: string;
    name: string;
    parentName: string | null;
    icon: string;
    color: string;
  };
};

export type TxFilter = {
  from?: string;
  to?: string;
  categoryId?: string;
  min?: number;
  max?: number;
  store?: string;
};

const parent = alias(categories, 'parent');

const viewColumns = {
  id: transactions.id,
  type: transactions.type,
  amount: transactions.amount,
  date: transactions.date,
  store: transactions.store,
  note: transactions.note,
  source: transactions.source,
  receiptKey: transactions.receiptKey,
  createdAt: transactions.createdAt,
  categoryId: categories.id,
  categoryName: categories.name,
  parentName: parent.name,
  icon: categories.icon,
  color: categories.color,
};

type ViewRow = Awaited<ReturnType<typeof selectViews>>[number];

function toView(r: ViewRow): TxView {
  return {
    id: r.id,
    type: r.type,
    amount: r.amount,
    date: r.date,
    store: r.store,
    note: r.note,
    source: r.source,
    receiptKey: r.receiptKey,
    createdAt: r.createdAt,
    category: {
      id: r.categoryId,
      name: r.categoryName,
      parentName: r.parentName ?? null,
      icon: r.icon,
      color: r.color,
    },
  };
}

function selectViews() {
  return getDb()
    .select(viewColumns)
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parent, eq(categories.parentId, parent.id));
}

async function assertCategory(userId: string, input: TxInput): Promise<void> {
  const [cat] = await getDb()
    .select({ type: categories.type })
    .from(categories)
    .where(
      and(eq(categories.id, input.categoryId), eq(categories.userId, userId)),
    );
  if (!cat) throw new ServiceError('not_found');
  if (cat.type !== input.type) throw new ServiceError('invalid_category');
}

export async function getTransaction(
  userId: string,
  id: string,
): Promise<TxView> {
  const [row] = await selectViews().where(
    and(
      eq(transactions.id, id),
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ),
  );
  if (!row) throw new ServiceError('not_found');
  return toView(row);
}

export async function createTransaction(
  userId: string,
  input: TxInput,
  source: 'app' | 'zalo' = 'app',
  receiptKey: string | null = null,
): Promise<TxView> {
  await assertCategory(userId, input);
  const [row] = await getDb()
    .insert(transactions)
    .values({ ...input, userId, source, receiptKey })
    .returning({ id: transactions.id });
  return getTransaction(userId, row.id);
}

// One INSERT statement, so every row shares the same created_at (Postgres
// now() is fixed per transaction). Undo relies on that to treat the rows as
// one batch.
export async function createTransactions(
  userId: string,
  inputs: TxInput[],
  source: 'app' | 'zalo' = 'app',
): Promise<TxView[]> {
  if (inputs.length === 0) return [];
  for (const input of inputs) await assertCategory(userId, input);
  const rows = await getDb()
    .insert(transactions)
    .values(inputs.map((input) => ({ ...input, userId, source })))
    .returning({ id: transactions.id });
  const views = await selectViews().where(
    and(
      eq(transactions.userId, userId),
      inArray(
        transactions.id,
        rows.map((r) => r.id),
      ),
    ),
  );
  const byId = new Map(views.map((r) => [r.id, toView(r)]));
  return rows.map((r) => byId.get(r.id)!);
}

export const UNDO_WINDOW_MS = 10 * 60 * 1000;

// Undoes the newest zalo batch: every row created by the same insert, e.g.
// all transfers read from one image.
export async function undoLatestZaloTransaction(
  userId: string,
  now: Date = new Date(),
): Promise<TxView[]> {
  const zaloLive = and(
    eq(transactions.userId, userId),
    eq(transactions.source, 'zalo'),
    isNull(transactions.deletedAt),
  );
  const [latest] = await getDb()
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        zaloLive,
        gte(transactions.createdAt, new Date(now.getTime() - UNDO_WINDOW_MS)),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);
  if (!latest) return [];
  // Compared in SQL: JS Dates drop the microseconds Postgres stores.
  const batch = and(
    zaloLive,
    sql`${transactions.createdAt} = (select ${transactions.createdAt} from ${transactions} where ${transactions.id} = ${latest.id})`,
  );
  const views = (
    await selectViews().where(batch).orderBy(transactions.date)
  ).map(toView);
  const deleted = await getDb()
    .update(transactions)
    .set({ deletedAt: now })
    .where(batch)
    .returning({ id: transactions.id });
  const deletedIds = new Set(deleted.map((r) => r.id));
  return views.filter((v) => deletedIds.has(v.id));
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: TxInput,
): Promise<TxView> {
  await assertCategory(userId, input);
  const updated = await getDb()
    .update(transactions)
    .set(input)
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning({ id: transactions.id });
  if (updated.length === 0) throw new ServiceError('not_found');
  return getTransaction(userId, id);
}

export async function softDeleteTransaction(
  userId: string,
  id: string,
): Promise<void> {
  const updated = await getDb()
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .returning({ id: transactions.id });
  if (updated.length === 0) throw new ServiceError('not_found');
}

// Unlike the single delete, an id already gone is not an error: undoing a batch
// should still remove the rest if one row was deleted by hand in the meantime.
export async function softDeleteTransactions(
  userId: string,
  ids: string[],
): Promise<void> {
  await getDb()
    .update(transactions)
    .set({ deletedAt: new Date() })
    .where(
      and(
        inArray(transactions.id, ids),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    );
}

export async function restoreTransaction(
  userId: string,
  id: string,
): Promise<void> {
  const updated = await getDb()
    .update(transactions)
    .set({ deletedAt: null })
    .where(
      and(
        eq(transactions.id, id),
        eq(transactions.userId, userId),
        isNotNull(transactions.deletedAt),
      ),
    )
    .returning({ id: transactions.id });
  if (updated.length === 0) throw new ServiceError('not_found');
}

function filterConditions(
  userId: string,
  filter: Omit<TxFilter, 'from' | 'to'> & { from?: string; to?: string },
): SQL[] {
  const conds: (SQL | undefined)[] = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
  ];
  if (filter.from) conds.push(gte(transactions.date, filter.from));
  if (filter.to) conds.push(lte(transactions.date, filter.to));
  if (filter.categoryId) {
    conds.push(
      or(
        eq(transactions.categoryId, filter.categoryId),
        eq(categories.parentId, filter.categoryId),
      ),
    );
  }
  if (filter.min !== undefined)
    conds.push(gte(transactions.amount, filter.min));
  if (filter.max !== undefined)
    conds.push(lte(transactions.amount, filter.max));
  if (filter.store) {
    const escaped = filter.store.replace(/[\\%_]/g, '\\$&');
    conds.push(ilike(transactions.store, `%${escaped}%`));
  }
  return conds.filter((c): c is SQL => c !== undefined);
}

export async function listTransactions(
  userId: string,
  filter: TxFilter,
): Promise<TxView[]> {
  const rows = await selectViews()
    .where(and(...filterConditions(userId, filter)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt));
  return rows.map(toView);
}

export async function hasTransactionsBefore(
  userId: string,
  date: string,
  filter: Omit<TxFilter, 'from' | 'to'>,
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(...filterConditions(userId, filter), lt(transactions.date, date)),
    )
    .limit(1);
  return rows.length > 0;
}

export async function recentTransactions(
  userId: string,
  limit: number,
): Promise<TxView[]> {
  const rows = await selectViews()
    .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit);
  return rows.map(toView);
}

export async function sumRange(
  userId: string,
  type: TxType,
  from: string,
  to: string,
): Promise<number> {
  const [row] = await getDb()
    .select({
      total: sql<string | null>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, type),
        isNull(transactions.deletedAt),
        gte(transactions.date, from),
        lte(transactions.date, to),
      ),
    );
  return Number(row?.total ?? 0);
}

export async function monthSummary(
  userId: string,
  today: string,
): Promise<{ spent: number; spentLastSameRange: number; income: number }> {
  const month = monthRange(today);
  const last = sameRangeLastMonth(today);
  const [spent, spentLastSameRange, income] = await Promise.all([
    sumRange(userId, 'out', month.from, today),
    sumRange(userId, 'out', last.from, last.to),
    sumRange(userId, 'in', month.from, month.to),
  ]);
  return { spent, spentLastSameRange, income };
}
