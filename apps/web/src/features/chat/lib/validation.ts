import { UuidSchema } from '@magic-prompt/shared';
import { z } from 'zod';

export const TitleSchema = z.string().trim().min(1).max(200);

export const CreateChatSchema = z.object({
  title: TitleSchema.optional(),
});

export const RenameChatSchema = z.object({
  chatId: UuidSchema,
  title: TitleSchema,
});

export const ChatIdOnlySchema = z.object({
  chatId: UuidSchema,
});

/**
 * Schema for the `/api/chat` POST body. Validates the message envelope the
 * AI SDK's `useChat` client sends — we accept the client's history but
 * authoritatively reload the last N messages from the DB before calling
 * the LLM.
 */
export const ChatRouteRequestSchema = z.object({
  chatId: UuidSchema,
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(32_000),
      }),
    )
    .min(1)
    .max(200),
});

export type ChatRouteRequest = z.infer<typeof ChatRouteRequestSchema>;
