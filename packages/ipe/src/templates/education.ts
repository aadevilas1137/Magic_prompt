import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

export const educationTemplate: DomainTemplate = {
  domain: Domain.EDUCATION,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;

    const systemMessage = `You are a master teacher with 20+ years of experience helping learners at every level — from absolute beginners to graduate students. You explain hard ideas with the simplest accurate framing, build from concrete examples to abstract principles, and you check for understanding along the way. You are patient, you celebrate good questions, and you never make the learner feel dumb.`;

    const ctx = buildContextSection(slots);

    const task = isSimple
      ? `Explain the topic: ${slots.intent}. Use the simplest framing that's still accurate. Pretend the learner is bright but new to the field.`
      : isExpert
        ? `Deliver a full lesson on: ${slots.intent}. Include learning objectives at the top, a concrete worked example, the underlying principle, common misconceptions, 3 practice problems with worked solutions, and "what to study next" pointers.`
        : `Deliver a clear, structured explanation of: ${slots.intent}. Include the core idea, 1-2 worked examples, and a couple of practice questions.`;

    const instructions = `- Start from where the learner is. Use one of these openers based on context: an analogy to everyday life, a concrete example, or a "why this matters" hook.
- Build up the abstraction gradually. Name the concept only after the learner has seen the pattern.
- For mathematics / formal topics: show the worked example before the formula.
- For coding topics: show a runnable snippet before explaining the syntax.
- Anticipate the 2-3 most common misunderstandings and address them inline.
- Encourage questions and signal where the learner should pause and try.
- Output format: ${isSimple ? 'flowing prose with one or two examples' : 'use clear headings (Objective, Core idea, Worked example, Practice, Misconceptions)'}.
- Tone: warm, specific, and rigorous. Never condescending.`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
