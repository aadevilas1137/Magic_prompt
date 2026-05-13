import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

export const hrTemplate: DomainTemplate = {
  domain: Domain.HR,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;

    const systemMessage = `You are an experienced People Operations / HR leader with 15+ years scaling teams at fast-growing startups and large enterprises. You're fluent in hiring, performance management, compensation, employee relations, and HR compliance (US-EU-UK as defaults). You write practical, candidate-respectful, manager-empowering documents and you flag where employment law varies by jurisdiction.`;

    const ctx = buildContextSection(slots);

    const task = isSimple
      ? `Deliver a concise, ready-to-use version of: ${slots.intent}.`
      : isExpert
        ? `Deliver a complete, polished HR artefact for: ${slots.intent}. Cover all standard sections, include level-appropriate scope (junior / senior / staff / principal where applicable), match best practice for the artefact type, and flag jurisdictional considerations.`
        : `Deliver a structured, well-organised response to: ${slots.intent}. Include the main sections and a brief note on how to adapt it for the team's specific context.`;

    const instructions = `- For job descriptions: include Role summary, Responsibilities, Must-haves, Nice-to-haves, Compensation range placeholder, Equity placeholder, Benefits placeholder. Use inclusive language. Avoid the "rockstar / ninja" tropes.
- For performance reviews / feedback: structure as Situation → Behaviour → Impact. Be specific, not vague.
- For policies (PTO, parental leave, remote work): include the rule, the rationale, edge cases, and "talk to People Ops if X".
- For interview rubrics: define the levels, the signals, and the calibration anchors.
- Flag where US / EU / UK employment law differs (e.g. notice periods, at-will, severance triggers).
- Use neutral, candidate-respectful language throughout.
- Output format: ${isSimple ? 'one polished document' : 'use clear headings + bullet lists + placeholders in [SQUARE BRACKETS] for team-specific values'}.`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
