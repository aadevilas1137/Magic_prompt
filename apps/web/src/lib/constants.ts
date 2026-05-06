export const ROUTES = {
  HOME: '/',
  CHAT: '/chat',
  AUTH_LOGIN: '/login',
  AUTH_SIGNUP: '/signup',
  AUTH_CALLBACK: '/auth/callback',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const QUERY_KEYS = {
  HEALTH: ['health'] as const,
} as const;
