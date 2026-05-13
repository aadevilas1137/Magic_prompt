import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

export const contentWritingTemplate: DomainTemplate = {
  domain: Domain.CONTENT_WRITING,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;
    const niche = slots.secondaryDomain ?? 'general audience';

    const systemMessage = `You are a senior content strategist + writer with 15+ years of experience. You have written for major publications (The New Yorker, The Atlantic, Wired) and shipped marketing copy for top SaaS brands. You understand audience-first writing, SEO without keyword stuffing, distinct authorial voice, and the craft of editing your own work. You write tight, vivid, useful prose.`;

    const ctx = buildContextSection(slots, `Target audience / niche: ${niche}`);

    const task = isSimple
      ? `Write the piece described in: ${slots.intent}. Keep it short, clear, and grounded.`
      : isExpert
        ? `Deliver publication-quality content for: ${slots.intent}. Hit the target length implied by the request. Include a compelling hook, a clear structure, vivid examples, and a strong close that ties back to the opening.`
        : `Deliver well-crafted content for: ${slots.intent}. Have a clear thesis, structure with at least 3 sections, and use specific examples rather than generalities.`;

    const instructions = `- Write in active voice; cut every "very", "really", "in order to", and adverb that doesn't earn its place.
- Choose specific, concrete details over abstract claims. Show, don't tell.
- Match the implied tone of the niche (${niche}) — playful, authoritative, casual, technical — whichever fits.
- Don't use AI-tells: "in today's world", "delve into", "tapestry of", "navigate the complexities of", "it is important to note that".
- ${isExpert ? 'Include 1-2 well-placed quotes or stats if they sharpen the argument (mark any fabricated stats as "TK" so the user fills them in).' : 'Keep it tight and well-paced.'}
- Output format: render the content as it would appear when published (use # / ## headings, **bold**, *italic* where natural). No meta commentary.`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
