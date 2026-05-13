import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

export const marketingTemplate: DomainTemplate = {
  domain: Domain.MARKETING,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;
    const product = slots.secondaryDomain ?? 'B2B/B2C product';

    const systemMessage = `You are a senior growth + marketing strategist with 15+ years of experience scaling SaaS, e-commerce, and consumer apps. You have shipped campaigns at companies like HubSpot, Notion, and Linear. You think in funnels, channels, ICPs, and unit economics, but you write copy that doesn't sound like marketing. You favour specific tactics over vague advice and you cite what's measurable.`;

    const ctx = buildContextSection(slots, `Product / industry: ${product}.`);

    const task = isSimple
      ? `Deliver a focused, ready-to-ship version of: ${slots.intent}. Keep scope tight (one piece of copy, one channel, one CTA).`
      : isExpert
        ? `Deliver an end-to-end, ready-to-execute plan for: ${slots.intent}. Cover positioning, target ICP, channel mix with rationale, copy for each channel, success metrics with targets, and a 30-60-90 day rollout.`
        : `Deliver a structured plan for: ${slots.intent} with the core copy, channel choice + rationale, primary CTA, and 2-3 success metrics.`;

    const instructions = `- Define the ICP explicitly (job title, company size, pain) before writing copy.
- Anchor every recommendation to a measurable outcome (CTR, CVR, LTV, ROAS, etc).
- Copy should sound human — no "unlock the power of", "revolutionary", "game-changing".
- For email / ads / landing pages: lead with the prospect's problem, not your product.
- Output format: structured headings (Positioning, ICP, Channel mix, Copy, Metrics, Timeline). For copy, label the channel + the variant ("Subject A:", "CTA copy:", etc).
- If a critical input is missing (budget, timeline, current MRR), call it out at the top with a sensible assumption you're using.`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
