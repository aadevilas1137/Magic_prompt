export type UserId = string;
export type ChatId = string;
export type MessageId = string;

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Chat {
  readonly id: ChatId;
  readonly userId: UserId;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const MessageRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export interface Message {
  readonly id: MessageId;
  readonly chatId: ChatId;
  readonly role: MessageRole;
  readonly content: string;
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
