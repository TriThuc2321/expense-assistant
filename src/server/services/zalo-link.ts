import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

import { env } from '@/configs/env';
import { isEmailAllowed } from '@/server/auth/allowlist';
import { getDb } from '@/server/db';
import {
  user,
  zaloLinkCodes,
  zaloLinks,
  zaloUpdates,
} from '@/server/db/schema';

export const LINK_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LINK_CODE_LENGTH = 6;
const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  }
  return code;
}

export async function createLinkCode(
  userId: string,
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
  return getDb().transaction(async (tx) => {
    await tx
      .delete(zaloLinkCodes)
      .where(
        and(eq(zaloLinkCodes.userId, userId), isNull(zaloLinkCodes.usedAt)),
      );
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      const inserted = await tx
        .insert(zaloLinkCodes)
        .values({ code, userId, expiresAt })
        .onConflictDoNothing()
        .returning({ code: zaloLinkCodes.code });
      if (inserted.length > 0) return { code, expiresAt };
    }
    throw new Error('Could not generate a unique link code');
  });
}

export async function redeemLinkCode(
  input: { code: string; zaloUserId: string; displayName: string },
  now: Date = new Date(),
): Promise<{ userId: string; userName: string } | null> {
  const code = input.code.trim().toUpperCase();
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(zaloLinkCodes)
      .where(eq(zaloLinkCodes.code, code))
      .for('update');
    if (!row || row.usedAt !== null || row.expiresAt <= now) return null;

    await tx
      .update(zaloLinkCodes)
      .set({ usedAt: now })
      .where(eq(zaloLinkCodes.code, code));
    await tx
      .delete(zaloLinks)
      .where(
        or(
          eq(zaloLinks.zaloUserId, input.zaloUserId),
          eq(zaloLinks.userId, row.userId),
        ),
      );
    await tx.insert(zaloLinks).values({
      zaloUserId: input.zaloUserId,
      userId: row.userId,
      displayName: input.displayName,
      linkedAt: now,
    });
    const [u] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, row.userId));
    return { userId: row.userId, userName: u.name };
  });
}

export async function getZaloLink(
  userId: string,
): Promise<{ displayName: string; linkedAt: Date } | null> {
  const [row] = await getDb()
    .select({
      displayName: zaloLinks.displayName,
      linkedAt: zaloLinks.linkedAt,
    })
    .from(zaloLinks)
    .where(eq(zaloLinks.userId, userId));
  return row ?? null;
}

export async function unlinkZalo(userId: string): Promise<void> {
  await getDb().delete(zaloLinks).where(eq(zaloLinks.userId, userId));
}

export async function findUserIdByZaloId(
  zaloUserId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ userId: zaloLinks.userId })
    .from(zaloLinks)
    .where(eq(zaloLinks.zaloUserId, zaloUserId));
  return row?.userId ?? null;
}

export async function findAllowedUserIdByZaloId(
  zaloUserId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ userId: zaloLinks.userId, email: user.email })
    .from(zaloLinks)
    .innerJoin(user, eq(user.id, zaloLinks.userId))
    .where(eq(zaloLinks.zaloUserId, zaloUserId));
  if (!row || !isEmailAllowed(row.email, env().ALLOWED_EMAILS)) return null;
  return row.userId;
}

export async function markUpdateSeen(updateId: string): Promise<boolean> {
  const rows = await getDb()
    .insert(zaloUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning({ updateId: zaloUpdates.updateId });
  return rows.length > 0;
}

export async function pruneZaloData(now: Date = new Date()): Promise<void> {
  const db = getDb();
  await db
    .delete(zaloUpdates)
    .where(lt(zaloUpdates.receivedAt, new Date(now.getTime() - 7 * DAY_MS)));
  await db
    .delete(zaloLinkCodes)
    .where(lt(zaloLinkCodes.expiresAt, new Date(now.getTime() - DAY_MS)));
}
