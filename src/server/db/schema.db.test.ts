import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getDb } from './index';
import {
  aiUsage,
  categories,
  transactions,
  user,
  zaloLinkCodes,
  zaloLinks,
} from './schema';
import { createTestUser, resetDb } from './test-utils';

const base = {
  name: 'A',
  icon: 'utensils',
  color: 'food',
  type: 'out',
} as const;

beforeEach(resetDb);

describe('schema constraints', () => {
  it('rejects duplicate (userId, slug)', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(categories)
      .values({ ...base, userId: u.id, slug: 'food' });
    await expect(
      getDb()
        .insert(categories)
        .values({ ...base, userId: u.id, slug: 'food', name: 'B' }),
    ).rejects.toThrow();
  });

  it('allows many null slugs per user', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(categories)
      .values([
        { ...base, userId: u.id, slug: null },
        { ...base, userId: u.id, slug: null, name: 'B' },
      ]);
    const rows = await getDb()
      .select()
      .from(categories)
      .where(eq(categories.userId, u.id));
    expect(rows).toHaveLength(2);
  });

  it('rejects non-positive amount', async () => {
    const u = await createTestUser();
    const [cat] = await getDb()
      .insert(categories)
      .values({ ...base, userId: u.id })
      .returning();
    await expect(
      getDb().insert(transactions).values({
        userId: u.id,
        type: 'out',
        amount: 0,
        categoryId: cat.id,
        date: '2026-11-03',
        source: 'app',
      }),
    ).rejects.toThrow();
  });

  it('cascades user delete to categories', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(categories)
      .values({ ...base, userId: u.id });
    await getDb().delete(user).where(eq(user.id, u.id));
    const rows = await getDb().select().from(categories);
    expect(rows).toHaveLength(0);
  });

  it('cascades zalo rows when the user is deleted', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(zaloLinks)
      .values({ zaloUserId: 'z1', userId: u.id, displayName: 'An' });
    await getDb()
      .insert(zaloLinkCodes)
      .values({
        code: 'ABC123',
        userId: u.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
    await getDb().delete(user).where(eq(user.id, u.id));
    expect(await getDb().select().from(zaloLinks)).toHaveLength(0);
    expect(await getDb().select().from(zaloLinkCodes)).toHaveLength(0);
  });

  it('defaults new users to role user and not blocked', async () => {
    const u = await createTestUser();
    const [row] = await getDb().select().from(user).where(eq(user.id, u.id));
    expect(row.role).toBe('user');
    expect(row.blockedAt).toBeNull();
  });

  it('cascades ai_usage when the user is deleted', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(aiUsage)
      .values({ userId: u.id, day: '2026-11-05', count: 1 });
    await getDb().delete(user).where(eq(user.id, u.id));
    expect(await getDb().select().from(aiUsage)).toHaveLength(0);
  });
});
