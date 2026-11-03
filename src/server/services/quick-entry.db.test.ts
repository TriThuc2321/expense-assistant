import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { LOCALE } from '@/constants/locale';
import { parseQuick } from '@/lib/parse-quick';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';
import { createTestUser, resetDb } from '@/server/db/test-utils';

import { ensureDefaultCategories } from './categories';
import { quickParseToInput } from './quick-entry';

beforeEach(resetDb);

async function slugId(userId: string, slug: string) {
  const [row] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.slug, slug)));
  return row.id;
}

describe('quickParseToInput', () => {
  it('maps a parse to the user category for its slug', async () => {
    const u = await createTestUser();
    await ensureDefaultCategories(u.id, LOCALE.VI);
    const parsed = parseQuick('grab 32k', '2026-10-14')!;
    const input = await quickParseToInput(u.id, parsed);
    expect(input.categoryId).toBe(await slugId(u.id, 'move.grab'));
    expect(input.amount).toBe(32000);
    expect(input.date).toBe('2026-10-14');
  });

  it('falls back to shop.goods when the slug category was deleted', async () => {
    const u = await createTestUser();
    await ensureDefaultCategories(u.id, LOCALE.VI);
    const goods = await slugId(u.id, 'shop.goods');
    await getDb()
      .delete(categories)
      .where(eq(categories.id, await slugId(u.id, 'move.grab')));
    const input = await quickParseToInput(
      u.id,
      parseQuick('grab 32k', '2026-10-14')!,
    );
    expect(input.categoryId).toBe(goods);
  });
});
