import { sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { UserRole } from '@/lib/types';

import { getDb } from './index';
import { user } from './schema';

export async function resetDb(): Promise<void> {
  await getDb().execute(sql`TRUNCATE "user" CASCADE`);
}

export async function createTestUser(
  overrides: Partial<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    blockedAt: Date | null;
  }> = {},
): Promise<{ id: string; email: string }> {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `${id}@example.com`;
  await getDb()
    .insert(user)
    .values({
      id,
      email,
      name: overrides.name ?? 'Test User',
      role: overrides.role,
      blockedAt: overrides.blockedAt,
    });
  return { id, email };
}
