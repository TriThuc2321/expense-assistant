import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const zaloLinks = pgTable('zalo_links', {
  zaloUserId: text('zalo_user_id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const zaloLinkCodes = pgTable(
  'zalo_link_codes',
  {
    code: text('code').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('zalo_link_codes_user').on(t.userId)],
);

export const zaloUpdates = pgTable('zalo_updates', {
  updateId: text('update_id').primaryKey(),
  receivedAt: timestamp('received_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ZaloLink = typeof zaloLinks.$inferSelect;
