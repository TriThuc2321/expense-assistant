import { and, asc, count, eq, isNull, max, sql } from 'drizzle-orm';

import type { Locale } from '@/i18n';
import type { TxType } from '@/lib/types';

import {
  type CategoryColor,
  DEFAULT_CATEGORIES,
} from '@/lib/categories-default';
import { pickCategoryForSlug } from '@/lib/category-pick';
import { getDb } from '@/server/db';
import { type Category, categories, transactions } from '@/server/db/schema';

import { ServiceError } from './errors';

export type CategoryNode = Category & {
  children: (Category & { txCount: number })[];
  txCount: number;
};

const ROOT_COLORS: CategoryColor[] = [
  'food',
  'home',
  'move',
  'shop',
  'fun',
  'health',
];

export async function ensureDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    // Serializes concurrent seeding per user so the emptiness check below is reliable.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const existing = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, userId))
      .limit(1);
    if (existing.length > 0) return;

    const onConflict = { target: [categories.userId, categories.slug] };

    await tx
      .insert(categories)
      .values(
        DEFAULT_CATEGORIES.map((root, i) => ({
          userId,
          slug: root.slug,
          name: root.name[locale],
          icon: root.icon,
          color: root.color,
          type: root.type,
          sortOrder: i,
        })),
      )
      .onConflictDoNothing(onConflict);

    const roots = await tx
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(eq(categories.userId, userId));
    const rootIds = new Map(roots.map((r) => [r.slug, r.id]));

    await tx
      .insert(categories)
      .values(
        DEFAULT_CATEGORIES.flatMap((root) =>
          root.children.map((child, i) => ({
            userId,
            parentId: rootIds.get(root.slug)!,
            slug: child.slug,
            name: child.name[locale],
            icon: root.icon,
            color: root.color,
            type: root.type,
            sortOrder: i,
          })),
        ),
      )
      .onConflictDoNothing(onConflict);
  });
}

export async function listCategories(userId: string): Promise<CategoryNode[]> {
  const db = getDb();
  const [rows, counts] = await Promise.all([
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.sortOrder)),
    db
      .select({ categoryId: transactions.categoryId, n: count() })
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      )
      .groupBy(transactions.categoryId),
  ]);
  const txCounts = new Map(counts.map((c) => [c.categoryId, c.n]));
  const own = (id: string) => txCounts.get(id) ?? 0;

  return rows
    .filter((r) => r.parentId === null)
    .map((root) => {
      const children = rows
        .filter((r) => r.parentId === root.id)
        .map((c) => ({ ...c, txCount: own(c.id) }));
      const txCount =
        own(root.id) + children.reduce((sum, c) => sum + c.txCount, 0);
      return { ...root, children, txCount };
    });
}

export async function createCategory(
  userId: string,
  input: { name: string; parentId: string | null },
): Promise<Category> {
  const name = input.name.trim();
  return getDb().transaction(async (tx) => {
    // Serializes per-user so the sibling duplicate check and sortOrder are race-free.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    let parent: Category | null = null;
    if (input.parentId !== null) {
      const [found] = await tx
        .select()
        .from(categories)
        .where(
          and(eq(categories.userId, userId), eq(categories.id, input.parentId)),
        );
      if (!found) throw new ServiceError('not_found');
      if (found.parentId !== null) throw new ServiceError('invalid_category');
      parent = found;
    }

    const siblingFilter = and(
      eq(categories.userId, userId),
      parent ? eq(categories.parentId, parent.id) : isNull(categories.parentId),
    );
    const siblings = await tx
      .select({ name: categories.name, sortOrder: categories.sortOrder })
      .from(categories)
      .where(siblingFilter);

    const key = (v: string) => v.normalize('NFC').toLowerCase();
    const lower = key(name);
    if (siblings.some((s) => key(s.name) === lower)) {
      throw new ServiceError('duplicate_name');
    }

    const [{ top }] = await tx
      .select({ top: max(categories.sortOrder) })
      .from(categories)
      .where(siblingFilter);

    const [created] = await tx
      .insert(categories)
      .values({
        userId,
        parentId: parent?.id ?? null,
        name,
        icon: parent?.icon ?? 'tag',
        color:
          parent?.color ?? ROOT_COLORS[siblings.length % ROOT_COLORS.length],
        type: parent?.type ?? 'out',
        sortOrder: (top ?? -1) + 1,
      })
      .returning();
    return created;
  });
}

export async function deleteSubcategory(
  userId: string,
  id: string,
): Promise<{ moved: number }> {
  return getDb().transaction(async (tx) => {
    const [child] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)));
    if (!child) throw new ServiceError('not_found');
    if (child.parentId === null) throw new ServiceError('invalid_category');

    const moved = await tx
      .update(transactions)
      .set({ categoryId: child.parentId })
      .where(
        and(eq(transactions.userId, userId), eq(transactions.categoryId, id)),
      )
      .returning({ id: transactions.id });
    await tx
      .delete(categories)
      .where(and(eq(categories.userId, userId), eq(categories.id, id)));
    return { moved: moved.length };
  });
}

export async function resolveCategorySlug(
  userId: string,
  slug: string,
  type?: TxType,
): Promise<string> {
  const rows = await getDb()
    .select({
      id: categories.id,
      slug: categories.slug,
      parentId: categories.parentId,
      type: categories.type,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.userId, userId));
  const id = pickCategoryForSlug(rows, slug, type);
  if (!id) throw new ServiceError('not_found');
  return id;
}
