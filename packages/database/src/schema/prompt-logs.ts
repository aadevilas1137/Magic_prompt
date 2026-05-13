import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { chats } from './chats';
import { messages } from './messages';
import { users } from './users';

/**
 * INTERNAL ONLY — prompt-engineering telemetry. Service-role writes only.
 * Client reads are blocked by the Phase 2 RESTRICTIVE deny-all RLS policy on
 * this table. Phase 8 RBAC will introduce admin-scoped reads.
 *
 * Phase 1 columns (legacy stubs, kept nullable for forward compat):
 *   - `domain`, `complexity`, `llm_used` — Phase 1 free-form fields; Phase 4
 *     populates the typed equivalents below (`primary_domain`,
 *     `complexity_score`, plus `llm_used` is still useful, kept populated).
 *
 * Phase 4 columns (the production telemetry surface):
 *   - `chat_id`, `message_id` — link to the chat/message that triggered the
 *     pipeline. ON DELETE CASCADE: if the chat is deleted, the logs go too.
 *   - `intent_json` / `classifier_json` — Layer 1 + Layer 2 outputs.
 *   - `primary_domain` / `secondary_domain` — typed classifier output
 *     (one of the 10 supported domains, or null for secondary).
 *   - `complexity_score` — 'simple' | 'moderate' | 'expert'.
 *   - `layer_latencies_ms` — `{ layer1, layer2, layer3 }` per-stage timings.
 *   - `quality_score` — Layer 5 score 0-100.
 *   - `quality_method` — 'heuristic' | 'llm_judge'.
 *   - `fallback_used` — true when IPE failed and the route used raw LLM path.
 *   - `error` — error message if the pipeline crashed; null on success.
 *   - `pipeline_version` — schema version stamped on every row.
 *
 * jsonb columns are typed at the application layer via Zod schemas defined
 * in `@magic-prompt/ipe/types`.
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

    // Legacy Phase 1 fields — kept nullable for forward compat; Phase 4 IPE
    // writes populate `primary_domain` / `complexity_score` instead.
    domain: text('domain'),
    complexity: integer('complexity'),
    llmUsed: text('llm_used'),

    // Phase 4 IPE columns
    chatId: uuid('chat_id').references(() => chats.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }),
    intentJson: jsonb('intent_json'),
    classifierJson: jsonb('classifier_json'),
    primaryDomain: varchar('primary_domain', { length: 64 }),
    secondaryDomain: varchar('secondary_domain', { length: 64 }),
    complexityScore: varchar('complexity_score', { length: 16 }),
    layerLatenciesMs: jsonb('layer_latencies_ms'),
    qualityScore: integer('quality_score'),
    qualityMethod: varchar('quality_method', { length: 32 }),
    fallbackUsed: boolean('fallback_used').notNull().default(false),
    error: text('error'),
    pipelineVersion: varchar('pipeline_version', { length: 16 }).notNull().default('v1'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('prompt_logs_user_id_idx').on(table.userId),
    createdAtIdx: index('prompt_logs_created_at_idx').on(table.createdAt),
    legacyDomainIdx: index('prompt_logs_domain_idx').on(table.domain),
    userCreatedIdx: index('idx_prompt_logs_user_created').on(table.userId, table.createdAt),
    primaryDomainIdx: index('idx_prompt_logs_domain').on(table.primaryDomain),
    complexityIdx: index('idx_prompt_logs_complexity').on(table.complexityScore),
  }),
);

export type PromptLogRow = typeof promptLogs.$inferSelect;
export type NewPromptLogRow = typeof promptLogs.$inferInsert;
