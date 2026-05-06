import posthog from 'posthog-js';
import { PostHog as PostHogServer } from 'posthog-node';

const DEFAULT_HOST = 'https://us.i.posthog.com';

export interface PostHogClientOptions {
  readonly apiKey?: string;
  readonly host?: string;
}

let serverClient: PostHogServer | null = null;
let clientInitialised = false;

export function initPostHogClient(opts: PostHogClientOptions = {}): void {
  if (typeof window === 'undefined' || clientInitialised) return;
  const key = opts.apiKey ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: opts.host ?? process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
  });
  clientInitialised = true;
}

export function getPostHogServer(): PostHogServer | null {
  if (serverClient) return serverClient;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  serverClient = new PostHogServer(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST,
    flushAt: 10,
    flushInterval: 1000,
  });
  return serverClient;
}

export interface TrackEvent {
  readonly distinctId: string;
  readonly event: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export function track(evt: TrackEvent): void {
  if (typeof window !== 'undefined') {
    if (!clientInitialised) return;
    posthog.identify(evt.distinctId);
    if (evt.properties !== undefined) {
      posthog.capture(evt.event, evt.properties as Record<string, unknown>);
    } else {
      posthog.capture(evt.event);
    }
    return;
  }
  const server = getPostHogServer();
  if (!server) return;
  server.capture({
    distinctId: evt.distinctId,
    event: evt.event,
    ...(evt.properties !== undefined
      ? { properties: evt.properties as Record<string, unknown> }
      : {}),
  });
}

export async function shutdownAnalytics(): Promise<void> {
  if (serverClient) {
    await serverClient.shutdown();
    serverClient = null;
  }
}

export { posthog };
