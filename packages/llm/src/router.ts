import { AppError, ErrorCode } from '@magic-prompt/shared';

import { OpenAIProvider } from './providers/openai';

import type { LLMProvider, ProviderName } from './types';

/**
 * LLM router — minimal Phase 3 implementation.
 *
 * Phase 3 ships a single provider (OpenAI). The router exists as a seam so
 * Phase 5+ can introduce real routing (domain → provider, capability matching,
 * cost ceilings, fallback chains) without touching the chat route handler.
 *
 * Today it's a thin factory: `getDefaultProvider()` returns a lazily-built
 * OpenAI provider; `getProvider(name)` switches on the provider name.
 */
export class LLMRouter {
  private cache: Partial<Record<ProviderName, LLMProvider>> = {};

  public getDefaultProvider(): LLMProvider {
    return this.getProvider('openai');
  }

  public getProvider(name: ProviderName): LLMProvider {
    const existing = this.cache[name];
    if (existing) return existing;

    if (name === 'openai') {
      const provider = new OpenAIProvider();
      this.cache[name] = provider;
      return provider;
    }
    throw new AppError({
      code: ErrorCode.NOT_IMPLEMENTED,
      message: `Provider "${name}" is not yet implemented. Phase 5+ adds Anthropic / Google.`,
    });
  }
}

let defaultRouter: LLMRouter | null = null;

/**
 * Process-wide singleton. Tests construct their own `LLMRouter` (or inject a
 * provider) instead of touching this.
 */
export function getDefaultRouter(): LLMRouter {
  if (!defaultRouter) defaultRouter = new LLMRouter();
  return defaultRouter;
}

/** Test helper — clears the cached singleton so a fresh router is built next call. */
export function __resetRouterForTests(): void {
  defaultRouter = null;
}
