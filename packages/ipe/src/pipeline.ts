import { promptLogs } from '@magic-prompt/database';
import { Complexity, Domain } from '@magic-prompt/shared';

import { runIntentParser } from './layers/1-intent-parser';
import { runDomainClassifier } from './layers/2-domain-classifier';
import { runMagicPromptConstructor } from './layers/3-magic-prompt-constructor';
import { runQualityValidator } from './layers/5-quality-validator';
import { trackIPEEvent, compactProperties } from './lib/analytics';
import { ipeLogger } from './lib/logger';
import { getServiceRoleDb, type ServiceRoleDb } from './lib/service-role-db';
import {
  DesiredOutput,
  type ClassifierResult,
  type IntentParserResult,
  type IPEConfig,
  type IPEInput,
  type IPEMetadata,
  type IPEResult,
  type LayerLatenciesMs,
  type OnStreamCompletePayload,
  type QualityResult,
} from './types';

const log = ipeLogger.child({ stage: 'pipeline' });

// Pre-defined fallbacks for hypothetical hard failures inside the orchestrator
// before any layer returns. The actual layer failures are handled inside each
// layer (they return `fallbackUsed: true` rather than throwing).
const DEFAULT_INTENT_FALLBACK: IntentParserResult = {
  intent: 'respond to user',
  implied_context: '',
  desired_output: DesiredOutput.OTHER,
  missing_params: [],
  confidence: 0.0,
};

const DEFAULT_CLASSIFIER_FALLBACK: ClassifierResult = {
  primary_domain: Domain.GENERAL,
  secondary_domain: null,
  complexity: Complexity.MODERATE,
  confidence: 0.0,
  reasoning: 'pipeline pre-classifier fallback',
};

// Exported only for tests + future contributors trying to understand "what
// shape does the pipeline default to if everything implodes".
export const __FALLBACKS = {
  intent: DEFAULT_INTENT_FALLBACK,
  classifier: DEFAULT_CLASSIFIER_FALLBACK,
};

export interface RunIPEParams {
  readonly input: IPEInput;
  readonly config: IPEConfig;
  /** Service-role DB handle override (tests pass mocks). */
  readonly db?: ServiceRoleDb;
  /** When `db` is unset, build the singleton from this connection string. */
  readonly dbConnectionString?: string;
}

/**
 * Run the 5-layer IPE pipeline.
 *
 *   Layer 1 → 2 → 3 (sequential, in this function)
 *   Layer 4 (streaming) happens in the route handler using `result.messages`
 *   Layer 5 (quality + persist) happens via `result.onStreamComplete()` after
 *           the LLM stream finishes
 *
 * Per-layer failures are caught INSIDE the layer (return `fallbackUsed: true`).
 * If a layer throws beyond that (config error, unexpected programming bug),
 * we propagate so `/api/chat` can decide whether to fall back to the Phase 3
 * raw-LLM path (`IPE_FALLBACK_ON_ERROR=true`) or surface a 500.
 */
export async function runIPE(params: RunIPEParams): Promise<IPEResult> {
  const { input, config } = params;

  trackIPEEvent({
    distinctId: input.userId,
    event: 'ipe.pipeline.started',
    properties: compactProperties({
      chatId: input.chatId,
      messageId: input.messageId,
    }),
  });

  const pipelineStart = Date.now();

  // -------- Layer 1: Intent Parser --------
  const intentOut = await runIntentParser(input.userMessage, {
    apiKey: config.openAIApiKey,
    model: config.intentModel,
    timeoutMs: config.intentTimeoutMs,
    ...(input.signal && { signal: input.signal }),
  });
  trackIPEEvent({
    distinctId: input.userId,
    event: intentOut.fallbackUsed ? 'ipe.layer1.failed' : 'ipe.layer1.completed',
    properties: compactProperties({
      latencyMs: intentOut.latencyMs,
      intent: intentOut.result.intent,
      confidence: intentOut.result.confidence,
      fallback: intentOut.fallbackUsed,
    }),
  });

  // -------- Layer 2: Domain Classifier --------
  const classifierOut = await runDomainClassifier(intentOut.result, input.userMessage, {
    apiKey: config.openAIApiKey,
    model: config.classifierModel,
    timeoutMs: config.classifierTimeoutMs,
    ...(input.signal && { signal: input.signal }),
  });
  trackIPEEvent({
    distinctId: input.userId,
    event: classifierOut.fallbackUsed ? 'ipe.pipeline.fallback' : 'ipe.layer2.completed',
    properties: compactProperties({
      latencyMs: classifierOut.latencyMs,
      primaryDomain: classifierOut.result.primary_domain,
      complexity: classifierOut.result.complexity,
      confidence: classifierOut.result.confidence,
      fallback: classifierOut.fallbackUsed,
      ...(classifierOut.fallbackUsed && { stage: 'layer2' }),
    }),
  });
  if (classifierOut.lowConfidence && !classifierOut.fallbackUsed) {
    trackIPEEvent({
      distinctId: input.userId,
      event: 'ipe.layer2.low_confidence',
      properties: compactProperties({
        confidence: classifierOut.result.confidence,
        primaryDomain: classifierOut.result.primary_domain,
      }),
    });
  }

  // -------- Layer 3: Magic Prompt Constructor --------
  const layer3 = runMagicPromptConstructor(
    intentOut.result,
    classifierOut.result,
    input.userMessage,
    { lowConfidence: classifierOut.lowConfidence },
  );
  trackIPEEvent({
    distinctId: input.userId,
    event: 'ipe.layer3.completed',
    properties: compactProperties({
      latencyMs: layer3.latencyMs,
      templateUsed: layer3.templateUsed,
      promptLength: layer3.prompt.systemMessage.length + layer3.prompt.userMessage.length,
      complexityCoerced: layer3.complexityCoerced,
    }),
  });

  // Cumulative budget log — useful for spotting latency regressions.
  const cumulativeMs = Date.now() - pipelineStart;
  log.info(
    {
      chatId: input.chatId,
      primaryDomain: classifierOut.result.primary_domain,
      complexity: classifierOut.result.complexity,
      layer1Ms: intentOut.latencyMs,
      layer2Ms: classifierOut.latencyMs,
      layer3Ms: layer3.latencyMs,
      cumulativeMs,
      fallbackUsed: intentOut.fallbackUsed || classifierOut.fallbackUsed,
    },
    'IPE layers 1-3 complete; handing off to streaming',
  );

  const layerLatenciesMs: LayerLatenciesMs = {
    layer1: intentOut.latencyMs,
    layer2: classifierOut.latencyMs,
    layer3: layer3.latencyMs,
  };

  const fallbackUsed = intentOut.fallbackUsed || classifierOut.fallbackUsed;

  const metadata: IPEMetadata = {
    intentJson: intentOut.result,
    classifierJson: classifierOut.result,
    primaryDomain: classifierOut.result.primary_domain,
    secondaryDomain: classifierOut.result.secondary_domain,
    complexityScore: classifierOut.result.complexity,
    magicPrompt: `${layer3.prompt.systemMessage}\n\n---\n\n${layer3.prompt.userMessage}`,
    pipelineVersion: config.pipelineVersion,
    layerLatenciesMs,
    fallbackUsed,
  };

  const onStreamComplete = async (payload: OnStreamCompletePayload): Promise<void> => {
    const validateStart = Date.now();
    trackIPEEvent({
      distinctId: input.userId,
      event: 'ipe.layer4.streamed',
      properties: compactProperties({
        totalDurationMs: validateStart - pipelineStart,
        model: payload.llmUsed,
        responseLength: payload.assistantContent.length,
      }),
    });

    const rng = config.rng ?? Math.random;
    const runJudge = rng() < config.qualitySampleRate;

    let quality: QualityResult | undefined;
    try {
      quality = await runQualityValidator({
        assistantContent: payload.assistantContent,
        originalInput: input.userMessage,
        classifier: classifierOut.result,
        runLLMJudge: runJudge,
        judgeModel: config.judgeModel,
        apiKey: config.openAIApiKey,
      });

      trackIPEEvent({
        distinctId: input.userId,
        event: 'ipe.layer5.scored',
        properties: compactProperties({
          qualityScore: quality.score,
          method: quality.method,
          primaryDomain: classifierOut.result.primary_domain,
          hasPromptLeakage: quality.hasPromptLeakage,
        }),
      });

      trackIPEEvent({
        distinctId: input.userId,
        event: 'ipe.pipeline.completed',
        properties: compactProperties({
          totalLatencyMs: Date.now() - pipelineStart,
          primaryDomain: classifierOut.result.primary_domain,
          complexity: classifierOut.result.complexity,
          qualityScore: quality.score,
        }),
      });
    } catch (err) {
      log.error(
        { err: err instanceof Error ? err.message : String(err) },
        'Layer 5 quality validator threw — recording row without quality data',
      );
      trackIPEEvent({
        distinctId: input.userId,
        event: 'ipe.pipeline.failed',
        properties: compactProperties({
          stage: 'layer5',
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    }

    // -------- Persist prompt_logs row --------
    const db = params.db ?? getDbFromConfig(params, config);
    try {
      await db.insert(promptLogs).values({
        userId: input.userId,
        chatId: input.chatId,
        messageId: input.messageId,
        originalInput: input.userMessage,
        magicPrompt: metadata.magicPrompt,
        intentJson: intentOut.result as unknown as Record<string, unknown>,
        classifierJson: classifierOut.result as unknown as Record<string, unknown>,
        primaryDomain: classifierOut.result.primary_domain,
        secondaryDomain: classifierOut.result.secondary_domain,
        complexityScore: classifierOut.result.complexity,
        llmUsed: payload.llmUsed,
        layerLatenciesMs: layerLatenciesMs as unknown as Record<string, unknown>,
        ...(quality !== undefined && {
          qualityScore: quality.score,
          qualityMethod: quality.method,
        }),
        fallbackUsed,
        pipelineVersion: config.pipelineVersion,
      });

      log.debug(
        {
          chatId: input.chatId,
          validateLatencyMs: Date.now() - validateStart,
          qualityMethod: quality?.method,
        },
        'prompt_logs row persisted',
      );
    } catch (err) {
      log.error(
        {
          chatId: input.chatId,
          err: err instanceof Error ? err.message : String(err),
        },
        'Failed to persist prompt_logs row (telemetry lost; user flow unaffected)',
      );
    }
  };

  return {
    messages: layer3.messages,
    metadata,
    onStreamComplete,
  };
}

function getDbFromConfig(params: RunIPEParams, config: IPEConfig): ServiceRoleDb {
  if (config.serviceRoleDb) return config.serviceRoleDb;
  if (!params.dbConnectionString) {
    throw new Error(
      'runIPE: no service-role DB available — pass `params.db` or `params.dbConnectionString`',
    );
  }
  return getServiceRoleDb({ connectionString: params.dbConnectionString });
}
