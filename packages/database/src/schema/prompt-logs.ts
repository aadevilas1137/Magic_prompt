import { index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * INTERNAL ONLY — prompt-engineering telemetry.
 *
 * This table is never exposed via a public API. RBAC will be enforced at the
 * route level once admin endpoints exist (Phase 8+). Treat every row as
 * sensitive: `original_input` may contain PII the user typed verbatim.
 */
export const promptLogs = pgTable(
  'prompt_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    originalInput: text('original_input').notNull(),
    magicPrompt: text('magic_prompt').notNull(),
    domain: text('domain').notNull(),
    complexity: integer('complexity').notNull(),
    llmUsed: text('llm_used').notNull(),
    qualityScore: real('quality_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('prompt_logs_user_id_idx').on(table.userId),
    createdAtIdx: index('prompt_logs_created_at_idx').on(table.createdAt),
    domainIdx: index('prompt_logs_domain_idx').on(table.domain),
  }),
);

export type PromptLogRow = typeof promptLogs.$inferSelect;
export type NewPromptLogRow = typeof promptLogs.$inferInsert;
