import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { getDb } from '@/server/db';
import {
  aiUsage,
  categories,
  session,
  transactions,
  user,
  zaloLinks,
} from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { ensureDefaultCategories } from './categories';
import {
  blockUser,
  deleteUser,
  listUsers,
  setUserRole,
  unblockUser,
} from './users';
import { findActiveUserIdByZaloId } from './zalo-link';

beforeEach(resetDb);

async function seedUserWithData(id: string) {
  await ensureDefaultCategories(id, LOCALE.VI);
  const cats = await getDb()
    .select()
    .from(categories)
    .where(eq(categories.userId, id));
  const child = cats.find((c) => c.type === 'out' && c.parentId !== null)!;
  const base = {
    userId: id,
    type: 'out' as const,
    source: 'app' as const,
    amount: 1000,
    categoryId: child.id,
    date: '2026-10-15',
  };
  await getDb()
    .insert(transactions)
    .values([base, { ...base, deletedAt: new Date() }]);
  await getDb()
    .insert(zaloLinks)
    .values({
      zaloUserId: `z-${id}`,
      userId: id,
      displayName: 'Zed',
    });
  await getDb()
    .insert(aiUsage)
    .values({ userId: id, day: '2026-10-15', count: 3 });
}

async function addSession(userId: string, token: string) {
  await getDb()
    .insert(session)
    .values({
      id: token,
      token,
      userId,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
}

const countRows = async (
  table: typeof transactions | typeof categories,
  id: string,
) => (await getDb().select().from(table).where(eq(table.userId, id))).length;

const mutators = {
  setUserRole: (a: string, t: string) => setUserRole(a, t, 'admin'),
  blockUser,
  unblockUser,
  deleteUser,
};

describe('listUsers', () => {
  it('lists users newest first', async () => {
    const a = await createTestUser({ name: 'A' });
    const b = await createTestUser({ name: 'B', role: 'admin' });
    const c = await createTestUser({ name: 'C' });
    const blockedAt = new Date('2026-10-20T00:00:00Z');
    await getDb()
      .update(user)
      .set({ createdAt: new Date('2026-01-01T00:00:00Z') })
      .where(eq(user.id, a.id));
    await getDb()
      .update(user)
      .set({ createdAt: new Date('2026-03-01T00:00:00Z'), blockedAt })
      .where(eq(user.id, b.id));
    await getDb()
      .update(user)
      .set({ createdAt: new Date('2026-02-01T00:00:00Z') })
      .where(eq(user.id, c.id));

    const list = await listUsers();
    expect(list.map((u) => u.id)).toEqual([b.id, c.id, a.id]);
    expect(list[0]).toEqual({
      id: b.id,
      name: 'B',
      email: b.email,
      image: null,
      role: 'admin',
      blockedAt,
      createdAt: new Date('2026-03-01T00:00:00Z'),
    });
  });
});

describe('setUserRole', () => {
  it('promotes and demotes', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser();
    const roleOf = async () =>
      (await getDb().select().from(user).where(eq(user.id, target.id)))[0]!
        .role;
    await setUserRole(admin.id, target.id, 'admin');
    expect(await roleOf()).toBe('admin');
    await setUserRole(admin.id, target.id, 'user');
    expect(await roleOf()).toBe('user');
  });
});

describe('blockUser / unblockUser', () => {
  it('sets blocked_at and removes every session of the target only', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser();
    const bystander = await createTestUser();
    await addSession(target.id, 't1');
    await addSession(target.id, 't2');
    await addSession(bystander.id, 'b1');

    await blockUser(admin.id, target.id);

    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, target.id));
    expect(row!.blockedAt).toBeInstanceOf(Date);
    const sessionsOf = async (id: string) =>
      (await getDb().select().from(session).where(eq(session.userId, id)))
        .length;
    expect(await sessionsOf(target.id)).toBe(0);
    expect(await sessionsOf(bystander.id)).toBe(1);
  });

  it('unblockUser clears blocked_at and keeps the Zalo link', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser({ blockedAt: new Date() });
    await getDb()
      .insert(zaloLinks)
      .values({ zaloUserId: 'z1', userId: target.id, displayName: 'Zed' });
    expect(await findActiveUserIdByZaloId('z1')).toBeNull();

    await unblockUser(admin.id, target.id);

    const [row] = await getDb()
      .select()
      .from(user)
      .where(eq(user.id, target.id));
    expect(row!.blockedAt).toBeNull();
    expect(await findActiveUserIdByZaloId('z1')).toBe(target.id);
  });
});

describe('deleteUser', () => {
  it('removes a user with live and soft-deleted transactions and nested categories', async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser();
    await seedUserWithData(target.id);
    await addSession(target.id, 't1');

    await deleteUser(admin.id, target.id);

    const db = getDb();
    expect(
      await db.select().from(user).where(eq(user.id, target.id)),
    ).toHaveLength(0);
    expect(await countRows(transactions, target.id)).toBe(0);
    expect(await countRows(categories, target.id)).toBe(0);
    expect(
      await db.select().from(session).where(eq(session.userId, target.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(zaloLinks).where(eq(zaloLinks.userId, target.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(aiUsage).where(eq(aiUsage.userId, target.id)),
    ).toHaveLength(0);
  });

  it("leaves other users' data alone", async () => {
    const admin = await createTestUser({ role: 'admin' });
    const target = await createTestUser();
    const other = await createTestUser();
    await seedUserWithData(target.id);
    await seedUserWithData(other.id);

    await deleteUser(admin.id, target.id);

    expect(await countRows(transactions, other.id)).toBe(2);
    expect((await countRows(categories, other.id)) > 0).toBe(true);
    expect(
      await getDb()
        .select()
        .from(zaloLinks)
        .where(and(eq(zaloLinks.userId, other.id))),
    ).toHaveLength(1);
    expect(
      await getDb().select().from(aiUsage).where(eq(aiUsage.userId, other.id)),
    ).toHaveLength(1);
  });
});

describe.each(Object.entries(mutators))('%s', (_name, mutate) => {
  it('rejects acting on yourself', async () => {
    const admin = await createTestUser({ role: 'admin' });
    await expect(mutate(admin.id, admin.id)).rejects.toMatchObject({
      code: 'cannot_modify_self',
    });
  });

  it('rejects a missing target', async () => {
    const admin = await createTestUser({ role: 'admin' });
    await expect(mutate(admin.id, 'missing')).rejects.toMatchObject({
      code: 'not_found',
    });
  });
});

describe('admin acting on admin', () => {
  it('an admin can act on another admin', async () => {
    const a = await createTestUser({ role: 'admin' });
    const b = await createTestUser({ role: 'admin' });
    await setUserRole(a.id, b.id, 'user');
    await blockUser(a.id, b.id);
    await unblockUser(a.id, b.id);
    await deleteUser(a.id, b.id);
    expect(
      await getDb().select().from(user).where(eq(user.id, b.id)),
    ).toHaveLength(0);
  });
});
