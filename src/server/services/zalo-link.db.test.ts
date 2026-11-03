import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '@/server/db';
import { zaloLinkCodes, zaloUpdates } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import {
  createLinkCode,
  findAllowedUserIdByZaloId,
  findUserIdByZaloId,
  getZaloLink,
  markUpdateSeen,
  pruneZaloData,
  redeemLinkCode,
  unlinkZalo,
} from './zalo-link';

const NOW = new Date('2026-11-03T10:00:00Z');
const redeem = (code: string, zaloUserId = 'z1', now = NOW) =>
  redeemLinkCode({ code, zaloUserId, displayName: 'Zed' }, now);

beforeEach(async () => {
  await resetDb();
  await getDb().execute(sql`TRUNCATE "zalo_updates"`);
});

describe('createLinkCode', () => {
  it('creates a 6-char code from the alphabet expiring in 10 minutes', async () => {
    const u = await createTestUser();
    const { code, expiresAt } = await createLinkCode(u.id, NOW);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 600_000);
  });

  it('invalidates the previous unused code when a new one is created', async () => {
    const u = await createTestUser();
    const a = await createLinkCode(u.id, NOW);
    const b = await createLinkCode(u.id, NOW);
    expect(await redeem(a.code)).toBeNull();
    expect(await redeem(b.code)).toMatchObject({ userId: u.id });
  });
});

describe('redeemLinkCode', () => {
  it('redeems case-insensitively with surrounding spaces and returns the name', async () => {
    const u = await createTestUser({ name: 'Linh' });
    const { code } = await createLinkCode(u.id, NOW);
    expect(await redeem(` ${code.toLowerCase()} `)).toEqual({
      userId: u.id,
      userName: 'Linh',
    });
  });

  it('rejects expired, used and unknown codes', async () => {
    const u = await createTestUser();
    const { code } = await createLinkCode(u.id, NOW);
    expect(
      await redeem(code, 'z1', new Date(NOW.getTime() + 600_001)),
    ).toBeNull();
    expect(await redeem(code)).not.toBeNull();
    expect(await redeem(code, 'z2')).toBeNull();
    expect(await redeem('ZZZZZZ')).toBeNull();
  });

  it('keeps one link per user and per zalo id, latest wins', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await redeem((await createLinkCode(a.id, NOW)).code, 'Z1');
    await redeem((await createLinkCode(b.id, NOW)).code, 'Z1');
    expect(await findUserIdByZaloId('Z1')).toBe(b.id);
    expect(await getZaloLink(a.id)).toBeNull();

    await redeem((await createLinkCode(b.id, NOW)).code, 'Z2');
    expect(await findUserIdByZaloId('Z1')).toBeNull();
    expect(await findUserIdByZaloId('Z2')).toBe(b.id);
  });
});

describe('links', () => {
  it('unlinks and reports no link', async () => {
    const u = await createTestUser();
    await redeem((await createLinkCode(u.id, NOW)).code, 'Z1');
    expect(await getZaloLink(u.id)).toMatchObject({ displayName: 'Zed' });
    await unlinkZalo(u.id);
    await unlinkZalo(u.id);
    expect(await getZaloLink(u.id)).toBeNull();
    expect(await findUserIdByZaloId('Z1')).toBeNull();
  });
});

describe('findAllowedUserIdByZaloId', () => {
  it('returns the linked user only while their email is allowed', async () => {
    const allowed = await createTestUser({ email: 'test@example.com' });
    const removed = await createTestUser({ email: 'gone@example.com' });
    await redeem((await createLinkCode(allowed.id, NOW)).code, 'Z1');
    await redeem((await createLinkCode(removed.id, NOW)).code, 'Z2');

    expect(await findAllowedUserIdByZaloId('Z1')).toBe(allowed.id);
    expect(await findAllowedUserIdByZaloId('Z2')).toBeNull();
    expect(await findAllowedUserIdByZaloId('Z3')).toBeNull();
  });
});

describe('dedupe and pruning', () => {
  it('markUpdateSeen returns true once then false', async () => {
    expect(await markUpdateSeen('m1')).toBe(true);
    expect(await markUpdateSeen('m1')).toBe(false);
  });

  it('prunes old updates and long-expired codes only', async () => {
    const u = await createTestUser();
    const day = 86_400_000;
    await getDb()
      .insert(zaloUpdates)
      .values([
        { updateId: 'old', receivedAt: new Date(NOW.getTime() - 8 * day) },
        { updateId: 'new', receivedAt: new Date(NOW.getTime() - 6 * day) },
      ]);
    await getDb()
      .insert(zaloLinkCodes)
      .values([
        {
          code: 'OLDOLD',
          userId: u.id,
          expiresAt: new Date(NOW.getTime() - 2 * day),
        },
        {
          code: 'NEWNEW',
          userId: u.id,
          expiresAt: new Date(NOW.getTime() - day / 2),
        },
      ]);
    await pruneZaloData(NOW);
    const updates = await getDb().select().from(zaloUpdates);
    expect(updates.map((r) => r.updateId)).toEqual(['new']);
    const codes = await getDb()
      .select()
      .from(zaloLinkCodes)
      .where(eq(zaloLinkCodes.userId, u.id));
    expect(codes.map((r) => r.code)).toEqual(['NEWNEW']);
  });
});
