import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { chats } from './chats';

export const messageRoleEnum = pgEnum('message_role', ['system', 'user', 'assistant']);

/**
 * `messages` — one row per turn in a chat.
 *
 * Phase 3 added: `token_count`, `model`, `error`, `parent_message_id`,
 * `latency_ms`. `parent_message_id` is a self-FK that Phase 6+ uses for
 * regenerate / branch semantics; today it's always NULL.
 *
 * `error` is set when an assistant turn failed mid-stream — `content` may
 * still hold a partial response, and the UI surfaces a retry CTA.
 */
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    chatId: uuid('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: messageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    model: varchar('model', { length: 64 }),
    error: text('error'),
    parentMessageId: uuid('parent_message_id').references((): AnyPgColumn => messages.id, {
      onDelete: 'set null',
    }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
    parentIdx: index('idx_messages_parent').on(table.parentMessageId),
  }),
);

export type MessageRow = typeof messages.$inferSelect;
export type NewMessageRow = typeof messages.$inferInsert;
