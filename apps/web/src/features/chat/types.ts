import type { Message, MessageRole } from '@magic-prompt/shared';

export type ChatMessage = Pick<Message, 'id' | 'role' | 'content' | 'createdAt'>;
export type { MessageRole };

export interface ChatComposerState {
  readonly draft: string;
  readonly isSending: boolean;
}
