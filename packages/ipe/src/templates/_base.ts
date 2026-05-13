import { Complexity, type Domain } from '@magic-prompt/shared';

import type { DomainTemplate, TemplateSlots } from '../types';

/**
 * Common section-building helpers shared across the 10 Phase 4 domain
 * templates. Keeps each template focused on its domain-specific content
 * instead of re-implementing prompt scaffolding.
 *
 * The output structure every template returns is a 4-part user message:
 *   ## Context — domain framing + implied context
 *   ## Task    — concrete deliverable, complexity-tier-aware
 *   ## Instructions — domain best practices, output format
 *   ## Data    — original user request + inferred parameters
 *
 * The system message is a domain-specific expert persona.
 */

export const COMPLEXITY_LABELS: Readonly<Record<Complexity, string>> = {
  [Complexity.SIMPLE]: 'Clean, demo-able, working',
  [Complexity.MODERATE]: 'Solid, well-structured, idiomatic',
  [Complexity.EXPERT]: 'Production-ready, ship-it quality',
};

export interface CommonSlots {
  readonly slots: TemplateSlots;
  /** Optional override for the "expert/senior" wording in the persona. */
  readonly personaSeniority?: string;
}

export function buildContextSection(slots: TemplateSlots, extra?: string): string {
  const parts: string[] = [];
  parts.push(`Industry / context: ${slots.impliedContext || '(general)'}`);
  if (slots.secondaryDomain) {
    parts.push(`Secondary domain: ${slots.secondaryDomain}`);
  }
  parts.push(`Project intent: ${slots.intent}`);
  parts.push(`Desired output: ${slots.desiredOutput}`);
  if (slots.missingParams.length > 0) {
    parts.push(
      `Note: the user did not specify: ${slots.missingParams.join(', ')}. Use sensible production defaults — do NOT ask the user clarifying questions; just decide and explain your choice briefly.`,
    );
  }
  if (extra) parts.push(extra);
  return parts.join('\n');
}

export function buildDataSection(slots: TemplateSlots, extra?: string): string {
  const parts: string[] = [
    `User's original request: "${slots.userMessage.trim()}"`,
    `Inferred implied context: ${slots.impliedContext || '(none)'}`,
    `Quality bar: ${COMPLEXITY_LABELS[slots.complexity]}`,
  ];
  if (extra) parts.push(extra);
  return parts.join('\n');
}

/**
 * Assemble the full 4-part user message + return the standard `MagicPrompt`.
 */
export function assemblePrompt(
  systemMessage: string,
  ctx: string,
  task: string,
  instructions: string,
  data: string,
): { readonly systemMessage: string; readonly userMessage: string } {
  return {
    systemMessage: systemMessage.trim(),
    userMessage: [
      '## Context',
      ctx,
      '',
      '## Task',
      task,
      '',
      '## Instructions',
      instructions,
      '',
      '## Data',
      data,
    ]
      .join('\n')
      .trim(),
  };
}

/** Short label used in template headers + tests for easy identification. */
export function templateLabel(domain: Domain, version: string): string {
  return `magic-prompt-template:${domain}@${version}`;
}

export type { DomainTemplate, TemplateSlots };
