import { desc, eq } from 'drizzle-orm';

import type { UserRole } from '@/lib/types';

import { getDb } from '@/server/db';
import { session, transactions, user } from '@/server/db/schema';

import { ServiceError } from './errors';

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  blockedAt: Date | null;
  createdAt: Date;
};

function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) throw new ServiceError('cannot_modify_self');
}

export async function listUsers(): Promise<UserListItem[]> {
  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      blockedAt: user.blockedAt,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt));
}

export async function setUserRole(
  actorId: string,
  targetId: string,
  role: UserRole,
): Promise<void> {
  assertNotSelf(actorId, targetId);
  const updated = await getDb()
    .update(user)
    .set({ role })
    .where(eq(user.id, targetId))
    .returning({ id: user.id });
  if (updated.length === 0) throw new ServiceError('not_found');
}

export async function blockUser(
  actorId: string,
  targetId: string,
): Promise<void> {
  assertNotSelf(actorId, targetId);
  await getDb().transaction(async (tx) => {
    const updated = await tx
      .update(user)
      .set({ blockedAt: new Date() })
      .where(eq(user.id, targetId))
      .returning({ id: user.id });
    if (updated.length === 0) throw new ServiceError('not_found');
    // Without a session row, a blocked user cannot reach /api/auth/* either.
    await tx.delete(session).where(eq(session.userId, targetId));
  });
}

export async function unblockUser(
  actorId: string,
  targetId: string,
): Promise<void> {
  assertNotSelf(actorId, targetId);
  const updated = await getDb()
    .update(user)
    .set({ blockedAt: null })
    .where(eq(user.id, targetId))
    .returning({ id: user.id });
  if (updated.length === 0) throw new ServiceError('not_found');
}

export async function deleteUser(
  actorId: string,
  targetId: string,
): Promise<void> {
  assertNotSelf(actorId, targetId);
  await getDb().transaction(async (tx) => {
    // The row lock conflicts with the key-share lock a concurrent Zalo insert
    // takes, so nothing can add a transaction between the deletes below and
    // trip the ON DELETE RESTRICT on categories.
    const locked = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, targetId))
      .for('update');
    if (locked.length === 0) throw new ServiceError('not_found');
    await tx.delete(transactions).where(eq(transactions.userId, targetId));
    await tx.delete(user).where(eq(user.id, targetId));
  });
}
