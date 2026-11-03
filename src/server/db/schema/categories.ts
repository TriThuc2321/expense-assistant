import {
  type AnyPgColumn,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import type { TxType } from '@/lib/types';

import { user } from './auth';

export const TX_TYPES = ['out', 'in'] as const satisfies readonly TxType[];

export const txType = pgEnum('tx_type', TX_TYPES);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
      onDelete: 'restrict',
    }),
    slug: text('slug'),
    name: text('name').notNull(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    type: txType('type').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('categories_user_slug').on(t.userId, t.slug)],
);

export type Category = typeof categories.$inferSelect;
