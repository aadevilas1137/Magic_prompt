import { boolean, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * `chats` — one row per user-owned chat session.
 *
 * Phase 3 added: `summary`, `last_message_at`, `is_archived`, `model`.
 * `last_message_at` is maintained by the `on_message_inserted` trigger
 * (see migration `0002_chat_enhancements.sql`). Do NOT assume callers will
 * update it — the trigger is the source of truth.
 *
 * Partial index `idx_chats_user_last_message` makes the sidebar query
 * (`WHERE user_id = ? AND is_archived = FALSE ORDER BY last_message_at DESC`)
 * an index-only scan.
 */
export const chats = pgTable(
  'chats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('New chat'),
    summary: text('summary'),
    model: varchar('model', { length: 64 }),
    isArchived: boolean('is_archived').notNull().default(false),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
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
