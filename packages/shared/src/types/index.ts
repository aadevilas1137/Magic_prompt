export type UserId = string;
export type ChatId = string;
export type MessageId = string;

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * `Chat` — public-shape representing a user's chat session.
 * Phase 3 added: `summary`, `model`, `isArchived`, `lastMessageAt`.
 */
export interface Chat {
  readonly id: ChatId;
  readonly userId: UserId;
  readonly title: string;
  readonly summary: string | null;
  readonly model: string | null;
  readonly isArchived: boolean;
  readonly lastMessageAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const MessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

/**
 * `Message` — public-shape representing a single chat turn.
 * Phase 3 added: `tokenCount`, `model`, `error`, `parentMessageId`, `latencyMs`.
 */
export interface Message {
  readonly id: MessageId;
  readonly chatId: ChatId;
  readonly role: MessageRole;
  readonly content: string;
  readonly tokenCount: number | null;
  readonly model: string | null;
  readonly error: string | null;
  readonly parentMessageId: MessageId | null;
  readonly latencyMs: number | null;
  readonly createdAt: Date;
}

export interface PaginationParams {
  readonly limit: number;
  readonly cursor?: string;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}
