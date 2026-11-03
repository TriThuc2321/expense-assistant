import { eq, sql } from 'drizzle-orm';

import type { Locale } from '@/i18n';

import { DEFAULT_CATEGORIES } from '@/lib/categories-default';
import { getDb } from '@/server/db';
import { categories } from '@/server/db/schema';

export async function ensureDefaultCategories(
  userId: string,
  locale: Locale,
): Promise<void> {
  await getDb().transaction(async (tx) => {
    // Serializes concurrent seeding per user so the emptiness check below is reliable.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const existing = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, userId))
      .limit(1);
    if (existing.length > 0) return;

    const onConflict = { target: [categories.userId, categories.slug] };

    await tx
      .insert(categories)
      .values(
        DEFAULT_CATEGORIES.map((root, i) => ({
          userId,
          slug: root.slug,
          name: root.name[locale],
          icon: root.icon,
          color: root.color,
          type: root.type,
          sortOrder: i,
        })),
      )
      .onConflictDoNothing(onConflict);

    const roots = await tx
      .select({ id: categories.id, slug: categories.slug })
      .from(categories)
      .where(eq(categories.userId, userId));
    const rootIds = new Map(roots.map((r) => [r.slug, r.id]));

    await tx
      .insert(categories)
      .values(
        DEFAULT_CATEGORIES.flatMap((root) =>
          root.children.map((child, i) => ({
            userId,
            parentId: rootIds.get(root.slug)!,
            slug: child.slug,
            name: child.name[locale],
            icon: root.icon,
            color: root.color,
            type: root.type,
            sortOrder: i,
          })),
        ),
      )
      .onConflictDoNothing(onConflict);
  });
}
