import { date, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';

import { user } from './auth';

export const aiUsage = pgTable(
  'ai_usage',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);
