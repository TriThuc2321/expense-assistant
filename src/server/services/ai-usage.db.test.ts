import { beforeEach, describe, expect, it } from 'vitest';

import { getDb } from '@/server/db';
import { aiUsage } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { consumeAiCall, pruneAiUsage } from './ai-usage';

const DAY = '2026-11-05';

beforeEach(resetDb);

describe('consumeAiCall', () => {
  it('allows calls up to the limit, then refuses', async () => {
    const u = await createTestUser();
    expect(await consumeAiCall(u.id, DAY, 2)).toBe(true);
    expect(await consumeAiCall(u.id, DAY, 2)).toBe(true);
    expect(await consumeAiCall(u.id, DAY, 2)).toBe(false);
  });

  it('cannot exceed the limit under concurrency', async () => {
    const u = await createTestUser();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeAiCall(u.id, DAY, 3)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it('resets the next day', async () => {
    const u = await createTestUser();
    await consumeAiCall(u.id, DAY, 1);
    expect(await consumeAiCall(u.id, DAY, 1)).toBe(false);
    expect(await consumeAiCall(u.id, '2026-11-06', 1)).toBe(true);
  });

  it('counts users separately', async () => {
    const [a, b] = [await createTestUser(), await createTestUser()];
    await consumeAiCall(a.id, DAY, 1);
    expect(await consumeAiCall(b.id, DAY, 1)).toBe(true);
  });

  it('exempts admins without writing a row', async () => {
    const u = await createTestUser({ role: 'admin' });
    expect(await consumeAiCall(u.id, DAY, 0)).toBe(true);
    expect(await getDb().select().from(aiUsage)).toHaveLength(0);
  });
});

describe('pruneAiUsage', () => {
  it('prunes rows older than 7 days only', async () => {
    const u = await createTestUser();
    await getDb()
      .insert(aiUsage)
      .values([
        { userId: u.id, day: '2026-10-28', count: 1 },
        { userId: u.id, day: '2026-10-29', count: 1 },
      ]);
    await pruneAiUsage(DAY);
    const rows = await getDb().select().from(aiUsage);
    expect(rows.map((r) => r.day)).toEqual(['2026-10-29']);
  });
});
