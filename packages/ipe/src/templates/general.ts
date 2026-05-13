import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

/**
 * General-purpose fallback template. Fires when the classifier confidence is
 * below threshold or the input genuinely doesn't fit a specialised domain.
 * Still much better than a static system prompt — it adapts to the parsed
 * intent + complexity tier.
 */
export const generalTemplate: DomainTemplate = {
  domain: Domain.GENERAL,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;

    const systemMessage = `You are a highly capable, thoughtful assistant. You speak clearly, answer the question that was actually asked, and don't pad your responses with filler. When you don't know something, you say so. You think before you speak and you double-check claims you make.`;

    const ctx = buildContextSection(slots);

    const task = isSimple
      ? `Answer: ${slots.intent}. Keep it short and direct.`
      : isExpert
        ? `Provide a thorough, well-organised response to: ${slots.intent}. Cover the question from multiple angles, anticipate likely follow-ups, and end with a concrete next step the user can take.`
        : `Provide a clear, well-organised response to: ${slots.intent}. Include the core answer, relevant context, and a brief next step if appropriate.`;

    const instructions = `- Answer the question that was asked, not a question you wish had been asked.
- Don't lead with "Great question!" or similar filler. Start with the substance.
- When stating facts, distinguish what's well-established from what's your inference.
- For multi-part questions, address each part in order.
- For ambiguous questions, briefly note the interpretation you're using before answering.
- Output format: ${isSimple ? 'plain text, no headings unless the answer naturally needs them' : 'use headings + bullet lists when the structure makes the answer easier to scan'}.
- Match the user's register — if they're casual, be casual; if they're formal, be formal.`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
