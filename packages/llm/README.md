# `@magic-prompt/llm`

LLM provider interface, router, and the production OpenAI implementation.

## What's here (Phase 3)

| Component                  | Phase   | Status                           |
| -------------------------- | ------- | -------------------------------- |
| `LLMProvider` interface    | Phase 1 | ✅ stable                        |
| `OpenAIProvider`           | Phase 3 | ✅ production (Vercel AI SDK v6) |
| `LLMRouter` (default-only) | Phase 3 | ✅ ships single-provider routing |
| Anthropic provider         | Phase 8 | ⏳ not started                   |
| Google provider            | Phase 8 | ⏳ not started                   |
| Real cost dashboards       | Phase 6 | ⏳ not started                   |

## Usage

### One-shot generation

```ts
import { OpenAIProvider } from '@magic-prompt/llm';

const provider = new OpenAIProvider({ defaultModel: 'gpt-4o-mini' });
const response = await provider.generate(
  [
    { role: 'system', content: 'You are concise.' },
    { role: 'user', content: 'Summarise React 19 features.' },
  ],
  { temperature: 0.3, maxTokens: 256, timeoutMs: 15_000 },
);

console.log(response.content); // string
console.log(response.usage); // { promptTokens, completionTokens, totalTokens }
console.log(response.latencyMs); // number
console.log(response.finishReason); // 'stop' | 'length' | …
```

### Streaming (used by `/api/chat`)

```ts
const stream = provider.stream(messages, {
  model: 'gpt-4o',
  onFinish: async ({ text, usage, model, latencyMs, finishReason }) => {
    // persist assistant message + metrics to DB
  },
  onError: async (err) => {
    // record partial-failure row
  },
});

// In a Next.js Route Handler:
return stream.toDataStreamResponse();
```

`toDataStreamResponse()` wraps AI SDK v6's `toUIMessageStreamResponse()` — the format `useChat` from `@ai-sdk/react` expects.

### Router

```ts
import { getDefaultRouter } from '@magic-prompt/llm';

const provider = getDefaultRouter().getDefaultProvider(); // → OpenAIProvider
```

Phase 5+ will replace the default-only behaviour with capability/cost-based routing across providers. The route handler shouldn't change.

## Error mapping

The provider catches AI SDK errors and re-throws them as `AppError`:

| Upstream                             | `AppError.code`          | User message                                        |
| ------------------------------------ | ------------------------ | --------------------------------------------------- |
| 401 / `invalid_api_key`              | `EXTERNAL_SERVICE_ERROR` | "OpenAI rejected the API key…"                      |
| 429 / rate limit                     | `RATE_LIMITED`           | "AI provider rate limit hit. Please wait a moment…" |
| 4xx / `context_length_exceeded`      | `VALIDATION_ERROR`       | "Conversation is too long for the model…"           |
| 5xx / network (after AI SDK retries) | `EXTERNAL_SERVICE_ERROR` | "AI provider is having trouble responding…"         |
| `AbortError`                         | `TIMEOUT`                | "AI request timed out…"                             |
| Unknown                              | `EXTERNAL_SERVICE_ERROR` | "Unexpected error talking to OpenAI."               |

## Configuration

Set in `apps/web/.env.local`:

```
OPENAI_API_KEY=sk-...           # required (≥20 chars, sk- prefix)
OPENAI_MODEL=gpt-4o             # default chat model
OPENAI_TITLE_MODEL=gpt-4o-mini  # used for auto-titles (cheaper)
```

`OpenAIProvider` reads `OPENAI_API_KEY` at construction time. Override per-instance via `new OpenAIProvider({ apiKey, defaultModel })`.

## Adding a new provider (Phase 8+)

1. Implement `LLMProvider` in `src/providers/<name>.ts`. Match the OpenAI provider's error-mapping shape.
2. Re-export from `src/providers/index.ts`.
3. Extend `LLMRouter.getProvider(name)` to construct your provider.
4. Add the env keys to `apps/web/src/lib/env.ts` + `apps/web/.env.example`.
5. Add a small set of unit tests in `apps/web/tests/unit/llm/<name>-provider.test.ts` (the package itself doesn't have its own vitest setup — co-located in the web app's test runner per Phase 3 deviation #1).
