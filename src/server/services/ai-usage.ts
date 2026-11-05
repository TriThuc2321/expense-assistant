import { eq, lt, sql } from 'drizzle-orm';

import { env } from '@/configs/env';
import { addDays } from '@/lib/dates';
import { getDb } from '@/server/db';
import { aiUsage, user } from '@/server/db/schema';

export async function consumeAiCall(
  userId: string,
  today: string,
  limit: number = env().AI_DAILY_LIMIT,
): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId));
  if (row?.role === 'admin') return true;

  const consumed = await db
    .insert(aiUsage)
    .values({ userId, day: today, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: { count: sql`${aiUsage.count} + 1` },
      where: lt(aiUsage.count, limit),
    })
    .returning({ count: aiUsage.count });
  return consumed.length > 0;
}

export async function pruneAiUsage(today: string): Promise<void> {
  await getDb()
    .delete(aiUsage)
    .where(lt(aiUsage.day, addDays(today, -7)));
}
