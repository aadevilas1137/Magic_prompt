export interface LLMRequest {
  readonly prompt: string;
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LLMUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface LLMResponse {
  readonly content: string;
  readonly model: string;
  readonly usage: LLMUsage;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LLMProvider {
  readonly name: string;
  generate(req: LLMRequest): Promise<LLMResponse>;
}

export type ProviderName = 'openai' | 'anthropic' | 'google';
