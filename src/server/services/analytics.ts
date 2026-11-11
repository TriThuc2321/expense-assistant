import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { TrendBucket, TrendPoint } from '@/lib/buckets';
import type { DateRange } from '@/lib/dates';
import type { TxType } from '@/lib/types';

import { fillBuckets } from '@/lib/buckets';
import { getDb } from '@/server/db';
import { categories, transactions } from '@/server/db/schema';

import { sumRange } from './transactions';

export type PeriodSummary = {
  income: number;
  expense: number;
  prevIncome: number;
  prevExpense: number;
};

export type CategoryChild = {
  id: string;
  name: string;
  total: number;
  isSelf: boolean;
};

export type CategoryTotal = {
  id: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  children: CategoryChild[];
};

function inRange(userId: string, range: DateRange) {
  return [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
    gte(transactions.date, range.from),
    lte(transactions.date, range.to),
  ];
}

export async function periodSummary(
  userId: string,
  range: DateRange,
  prev: DateRange,
): Promise<PeriodSummary> {
  const [income, expense, prevIncome, prevExpense] = await Promise.all([
    sumRange(userId, 'in', range.from, range.to),
    sumRange(userId, 'out', range.from, range.to),
    sumRange(userId, 'in', prev.from, prev.to),
    sumRange(userId, 'out', prev.from, prev.to),
  ]);
  return { income, expense, prevIncome, prevExpense };
}

export async function categoryBreakdown(
  userId: string,
  type: TxType,
  range: DateRange,
): Promise<CategoryTotal[]> {
  const parent = alias(categories, 'parent');
  const rows = await getDb()
    .select({
      id: categories.id,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      parentId: parent.id,
      parentName: parent.name,
      parentIcon: parent.icon,
      parentColor: parent.color,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parent, eq(categories.parentId, parent.id))
    .where(and(...inRange(userId, range), eq(transactions.type, type)))
    .groupBy(categories.id, parent.id);

  const byParent = new Map<string, CategoryTotal>();
  for (const r of rows) {
    const total = Number(r.total);
    if (total <= 0) continue;
    const isSelf = r.parentId === null;
    const key = r.parentId ?? r.id;
    let group = byParent.get(key);
    if (!group) {
      group = {
        id: key,
        name: r.parentName ?? r.name,
        icon: r.parentIcon ?? r.icon,
        color: r.parentColor ?? r.color,
        total: 0,
        children: [],
      };
      byParent.set(key, group);
    }
    group.total += total;
    group.children.push({ id: r.id, name: r.name, total, isSelf });
  }

  const byTotal = (a: { total: number }, b: { total: number }) =>
    b.total - a.total;
  return [...byParent.values()]
    .map((g) => ({
      ...g,
      children: g.children.some((c) => !c.isSelf)
        ? g.children.sort(byTotal)
        : [],
    }))
    .sort(byTotal);
}

export async function trend(
  userId: string,
  range: DateRange,
  axis: DateRange,
  bucket: TrendBucket,
): Promise<TrendPoint[]> {
  const key =
    bucket === 'day'
      ? sql<string>`${transactions.date}::text`
      : sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
  const rows = await getDb()
    .select({
      key,
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'in'), 0)`,
      expense: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'out'), 0)`,
    })
    .from(transactions)
    .where(and(...inRange(userId, range)))
    .groupBy(key);
  return fillBuckets(
    rows.map((r) => ({
      key: r.key,
      income: Number(r.income),
      expense: Number(r.expense),
    })),
    axis,
    bucket,
  );
}
