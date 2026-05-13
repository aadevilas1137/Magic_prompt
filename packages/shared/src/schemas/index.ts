import { z } from 'zod';

import { MessageRole } from '../types';

export const UuidSchema = z.string().uuid();
export const EmailSchema = z.string().email().toLowerCase();
export const IsoDateSchema = z.coerce.date();

export const UserSchema = z.object({
  id: UuidSchema,
  email: EmailSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const ChatSchema = z.object({
  id: UuidSchema,
  userId: UuidSchema,
  title: z.string().min(1).max(200),
  summary: z.string().nullable(),
  model: z.string().max(64).nullable(),
  isArchived: z.boolean(),
  lastMessageAt: IsoDateSchema,
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
});

export const MessageRoleSchema = z.enum([
  MessageRole.SYSTEM,
  MessageRole.USER,
  MessageRole.ASSISTANT,
]);

export const MessageSchema = z.object({
  id: UuidSchema,
  chatId: UuidSchema,
  role: MessageRoleSchema,
  content: z.string().min(1),
  tokenCount: z.number().int().nonnegative().nullable(),
  model: z.string().max(64).nullable(),
  error: z.string().nullable(),
  parentMessageId: UuidSchema.nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  createdAt: IsoDateSchema,
});

export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
