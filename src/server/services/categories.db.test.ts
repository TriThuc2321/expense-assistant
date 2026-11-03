import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import { categories, transactions } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import {
  createCategory,
  deleteSubcategory,
  ensureDefaultCategories,
  listCategories,
  resolveCategorySlug,
} from './categories';
import { ServiceError } from './errors';

const rowsFor = (userId: string) =>
  getDb().select().from(categories).where(eq(categories.userId, userId));

beforeEach(resetDb);

describe('ensureDefaultCategories', () => {
  it('seeds 7 roots and 22 children with locale names', async () => {
    const u = await createTestUser();
    await ensureDefaultCategories(u.id, LOCALE.EN);
    const rows = await rowsFor(u.id);
    expect(rows.filter((r) => r.parentId === null)).toHaveLength(7);
    expect(rows.filter((r) => r.parentId !== null)).toHaveLength(22);
    const lunch = rows.find((r) => r.slug === 'food.lunch')!;
    expect(lunch.name).toBe('Lunch');
    expect(lunch.parentId).toBe(rows.find((r) => r.slug === 'food')!.id);
    expect(lunch).toMatchObject({
      icon: 'utensils',
      color: 'food',
      type: 'out',
    });
  });

  it('is idempotent, including concurrent calls', async () => {
    const u = await createTestUser();
    await Promise.all([
      ensureDefaultCategories(u.id, LOCALE.VI),
      ensureDefaultCategories(u.id, LOCALE.VI),
    ]);
    await ensureDefaultCategories(u.id, LOCALE.VI);
    expect(await rowsFor(u.id)).toHaveLength(29);
  });

  it('skips users who already have any category', async () => {
    const u = await createTestUser();
    await getDb().insert(categories).values({
      userId: u.id,
      name: 'Custom',
      icon: 'tag',
      color: 'food',
      type: 'out',
    });
    await ensureDefaultCategories(u.id, LOCALE.VI);
    expect(await rowsFor(u.id)).toHaveLength(1);
  });

  it('only touches the given user', async () => {
    const u1 = await createTestUser();
    const u2 = await createTestUser();
    await ensureDefaultCategories(u1.id, LOCALE.VI);
    expect(await rowsFor(u2.id)).toHaveLength(0);
  });
});

const seeded = async () => {
  const u = await createTestUser();
  await ensureDefaultCategories(u.id, LOCALE.VI);
  const rows = await rowsFor(u.id);
  const bySlug = (slug: string) => rows.find((r) => r.slug === slug)!;
  return { u, bySlug };
};

const addTx = (
  userId: string,
  categoryId: string,
  deletedAt: Date | null = null,
) =>
  getDb().insert(transactions).values({
    userId,
    type: 'out',
    amount: 1000,
    categoryId,
    date: '2026-11-01',
    source: 'app',
    deletedAt,
  });

const codeOf = async (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => (e instanceof ServiceError ? e.code : 'other'),
  );

describe('listCategories', () => {
  it('lists roots with children and live tx counts', async () => {
    const { u, bySlug } = await seeded();
    await addTx(u.id, bySlug('food.coffee').id);
    await addTx(u.id, bySlug('food.coffee').id);
    await addTx(u.id, bySlug('food.lunch').id);
    await addTx(u.id, bySlug('food.lunch').id, new Date());
    const list = await listCategories(u.id);
    expect(list).toHaveLength(7);
    expect(list.map((r) => r.slug)).toEqual(
      [...list].sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.slug),
    );
    const food = list.find((r) => r.slug === 'food')!;
    expect(food.txCount).toBe(3);
    expect(food.children).toHaveLength(4);
    expect(food.children.find((c) => c.slug === 'food.coffee')!.txCount).toBe(
      2,
    );
    expect(food.children.find((c) => c.slug === 'food.lunch')!.txCount).toBe(1);
    expect(list.find((r) => r.slug === 'home')!.txCount).toBe(0);
  });
});

describe('createCategory', () => {
  it('creates a child inheriting icon/color/type and next sortOrder', async () => {
    const { u, bySlug } = await seeded();
    const food = bySlug('food');
    const child = await createCategory(u.id, {
      name: '  Trà sữa ',
      parentId: food.id,
    });
    expect(child).toMatchObject({
      name: 'Trà sữa',
      parentId: food.id,
      icon: food.icon,
      color: food.color,
      type: food.type,
      sortOrder: 4,
      slug: null,
    });
  });

  it('creates a root with defaults and cycling color', async () => {
    const { u } = await seeded();
    const root = await createCategory(u.id, {
      name: 'Du lịch',
      parentId: null,
    });
    expect(root).toMatchObject({
      icon: 'tag',
      type: 'out',
      parentId: null,
      color: 'home',
    });
  });

  it('rejects a duplicate sibling name case-insensitively', async () => {
    const { u, bySlug } = await seeded();
    expect(
      await codeOf(
        createCategory(u.id, {
          name: 'cà phê',
          parentId: bySlug('food').id,
        }),
      ),
    ).toBe('duplicate_name');
  });

  it('rejects a grandchild', async () => {
    const { u, bySlug } = await seeded();
    expect(
      await codeOf(
        createCategory(u.id, {
          name: 'Sâu',
          parentId: bySlug('food.coffee').id,
        }),
      ),
    ).toBe('invalid_category');
  });

  it("cannot touch another user's category", async () => {
    const { bySlug } = await seeded();
    const u2 = await createTestUser();
    expect(
      await codeOf(
        createCategory(u2.id, { name: 'X', parentId: bySlug('food').id }),
      ),
    ).toBe('not_found');
    expect(
      await codeOf(deleteSubcategory(u2.id, bySlug('food.coffee').id)),
    ).toBe('not_found');
  });
});

describe('deleteSubcategory', () => {
  it('moves live and soft-deleted transactions to the parent on delete', async () => {
    const { u, bySlug } = await seeded();
    const coffee = bySlug('food.coffee');
    await addTx(u.id, coffee.id);
    await addTx(u.id, coffee.id, new Date());
    expect(await deleteSubcategory(u.id, coffee.id)).toEqual({ moved: 2 });
    const txs = await getDb()
      .select()
      .from(transactions)
      .where(eq(transactions.userId, u.id));
    expect(txs.map((t) => t.categoryId)).toEqual([
      bySlug('food').id,
      bySlug('food').id,
    ]);
    expect((await rowsFor(u.id)).some((r) => r.id === coffee.id)).toBe(false);
  });

  it('refuses to delete a root', async () => {
    const { u, bySlug } = await seeded();
    expect(await codeOf(deleteSubcategory(u.id, bySlug('food').id))).toBe(
      'invalid_category',
    );
  });
});

describe('resolveCategorySlug', () => {
  it('resolves slugs with fallback after the slug category was deleted', async () => {
    const { u, bySlug } = await seeded();
    expect(await resolveCategorySlug(u.id, 'food.coffee')).toBe(
      bySlug('food.coffee').id,
    );
    await deleteSubcategory(u.id, bySlug('food.coffee').id);
    expect(await resolveCategorySlug(u.id, 'food.coffee')).toBe(
      bySlug('shop.goods').id,
    );
    await deleteSubcategory(u.id, bySlug('shop.goods').id);
    expect(await resolveCategorySlug(u.id, 'food.coffee')).toBe(
      bySlug('food').id,
    );
  });

  it('throws not_found when the user has no out root', async () => {
    const u = await createTestUser();
    expect(await codeOf(resolveCategorySlug(u.id, 'food.coffee'))).toBe(
      'not_found',
    );
  });
});
