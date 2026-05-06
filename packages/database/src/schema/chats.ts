import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('chats_user_id_idx').on(table.userId),
    createdAtIdx: index('chats_created_at_idx').on(table.createdAt),
  }),
);

export type ChatRow = typeof chats.$inferSelect;
export type NewChatRow = typeof chats.$inferInsert;
