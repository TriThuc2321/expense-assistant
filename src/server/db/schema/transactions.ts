import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth';
import { categories, txType } from './categories';

export const txSource = pgEnum('tx_source', ['app', 'zalo']);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    type: txType('type').notNull(),
    amount: bigint('amount', { mode: 'number' }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    store: text('store'),
    note: text('note'),
    date: date('date', { mode: 'string' }).notNull(),
    source: txSource('source').notNull(),
    receiptKey: text('receipt_key'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('transactions_user_date').on(t.userId, t.date),
    check('transactions_amount_positive', sql`${t.amount} > 0`),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
