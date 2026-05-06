# `@magic-prompt/analytics`

PostHog wrapper for client + server. Becomes a silent no-op when `NEXT_PUBLIC_POSTHOG_KEY` is missing.

## Usage

```ts
import { initPostHogClient, track } from '@magic-prompt/analytics';

initPostHogClient(); // call once on the client
track({
  distinctId: user.id,
  event: 'chat.sent',
  properties: { domain: 'code', complexity: 4 },
});
```

For a graceful server shutdown:

```ts
import { shutdownAnalytics } from '@magic-prompt/analytics';
await shutdownAnalytics();
```
