import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { ensureDefaultCategories } from './categories';

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
