import 'server-only';

import { promptLogs } from '@magic-prompt/database';
import { AppError, ErrorCode, type ChatId, type UserId } from '@magic-prompt/shared';
import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db';

/**
 * Public-shape for the IPE debug panel. Includes the magic prompt — this is
 * an INTERNAL admin surface only, gated by `isIPEAdmin()` upstream.
 */
export interface IPEDebugRow {
  readonly id: string;
  readonly messageId: string | null;
  readonly originalInput: string;
  readonly magicPrompt: string;
  readonly intentJson: unknown;
  readonly classifierJson: unknown;
  readonly primaryDomain: string | null;
  readonly secondaryDomain: string | null;
  readonly complexityScore: string | null;
  readonly layerLatenciesMs: unknown;
  readonly qualityScore: number | null;
  readonly qualityMethod: string | null;
  readonly fallbackUsed: boolean;
  readonly pipelineVersion: string;
  readonly error: string | null;
  readonly createdAt: Date;
}

/**
 * Fetch the IPE debug data for a single chat. RLS deny-all on prompt_logs
 * blocks the regular Supabase client, so this uses the same Drizzle handle
 * the chat route uses (Drizzle connects with elevated privileges — the
 * effective "service-role" path described in `service-role-db.ts`).
 *
 * Caller MUST gate access via `isIPEAdmin()`. This function trusts the call.
 */
export async function getIPEDebugForChat(input: {
  userId: UserId;
  chatId: ChatId;
  limit?: number;
}): Promise<readonly IPEDebugRow[]> {
  const limit = Math.min(Math.max(1, input.limit ?? 100), 200);
  const db = getDb();

  try {
    const rows = await db
      .select({
        id: promptLogs.id,
        messageId: promptLogs.messageId,
        originalInput: promptLogs.originalInput,
        magicPrompt: promptLogs.magicPrompt,
        intentJson: promptLogs.intentJson,
        classifierJson: promptLogs.classifierJson,
        primaryDomain: promptLogs.primaryDomain,
        secondaryDomain: promptLogs.secondaryDomain,
        complexityScore: promptLogs.complexityScore,
        layerLatenciesMs: promptLogs.layerLatenciesMs,
        qualityScore: promptLogs.qualityScore,
        qualityMethod: promptLogs.qualityMethod,
        fallbackUsed: promptLogs.fallbackUsed,
        pipelineVersion: promptLogs.pipelineVersion,
        error: promptLogs.error,
        createdAt: promptLogs.createdAt,
      })
      .from(promptLogs)
      .where(and(eq(promptLogs.userId, input.userId), eq(promptLogs.chatId, input.chatId)))
      .orderBy(desc(promptLogs.createdAt))
      .limit(limit);
    return rows;
  } catch (err) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Failed to load IPE debug data.',
      cause: err,
      metadata: { chatId: input.chatId },
    });
  }
}
