import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Application-level users table.
 * `id` matches `auth.users.id` from the Supabase auth schema (1:1 mapping).
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
