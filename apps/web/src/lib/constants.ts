export const ROUTES = {
  HOME: '/',
  CHAT: '/chat',
  CHAT_NEW: '/chat/new',
  AUTH_LOGIN: '/login',
  AUTH_SIGNUP: '/signup',
  AUTH_CALLBACK: '/auth/callback',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export function chatRoute(chatId: string): string {
  return `/chat/${chatId}`;
}

export const QUERY_KEYS = {
  HEALTH: ['health'] as const,
  chats: {
    all: ['chats'] as const,
    list: (opts: { userId: string; includeArchived?: boolean }) =>
      ['chats', 'list', opts.userId, Boolean(opts.includeArchived)] as const,
    detail: (chatId: string) => ['chats', 'detail', chatId] as const,
    messages: (chatId: string) => ['chats', 'messages', chatId] as const,
    stats: (userId: string) => ['chats', 'stats', userId] as const,
  },
} as const;
