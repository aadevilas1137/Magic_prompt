import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
  type TemplateSlots,
} from './_base';

function inferTechStack(slots: TemplateSlots): string {
  const ctx = slots.impliedContext.toLowerCase();
  const msg = slots.userMessage.toLowerCase();
  if (ctx.includes('react native') || msg.includes('react native')) return 'React Native + Expo';
  if (ctx.includes('vue') || msg.includes('vue')) return 'Vue 3 + Vite';
  if (ctx.includes('svelte') || msg.includes('svelte')) return 'SvelteKit';
  if (ctx.includes('python') || msg.includes('django') || msg.includes('flask')) {
    return 'Python + FastAPI + Jinja2 templates';
  }
  return 'Next.js 14 (App Router) + Tailwind CSS + TypeScript';
}

export const webDevelopmentTemplate: DomainTemplate = {
  domain: Domain.WEB_DEVELOPMENT,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;
    const techStack = inferTechStack(slots);
    const audience = slots.secondaryDomain
      ? `${slots.secondaryDomain} industry`
      : 'broad consumer / SaaS';

    const systemMessage = `You are a world-class Full-Stack Web Developer with 15+ years of experience shipping production websites at companies like Stripe, Linear, and Vercel. You have deep expertise in ${techStack} and have built sites for the ${audience}. You write clean, modern, accessible, performant code that follows current industry best practices. You favour pragmatic defaults over hand-wavy choices and you ship code that runs out of the box.`;

    const ctx = buildContextSection(slots, `Recommended tech stack: ${techStack}`);

    const task = isSimple
      ? `Deliver a working, demo-able implementation of: ${slots.intent}. Keep scope tight — a single file or small set of files is fine. Focus on clarity over feature-completeness.`
      : isExpert
        ? `Deliver a complete, production-ready implementation of: ${slots.intent}. Provide:
- Full ${techStack} codebase
- All pages, layouts, and components needed to ship
- Responsive design (mobile-first; design hits at 375px, 768px, 1280px)
- SEO meta tags + structured data where applicable
- Accessibility: semantic HTML, ARIA labels, keyboard navigation, focus management
- Form handling with client+server validation
- Loading + error states for every async surface
- A README with setup commands, file structure, and design decisions`
        : `Deliver a solid, well-structured implementation of: ${slots.intent}. Include:
- Working ${techStack} code organised by feature
- Responsive design
- Basic accessibility (semantic HTML, alt text, focus rings)
- Loading + error states for the main async paths
- A short README`;

    const instructions = `- Use ${techStack} unless the user's request implies otherwise.
- Write code that runs out-of-the-box — no missing pieces or "fill this in" placeholders.
- Use semantic HTML (<main>, <nav>, <article>, <section>) and ARIA where appropriate.
- Replace lorem-ipsum-style filler with realistic, plausible content that matches the domain.
- Comment non-obvious logic; never comment self-evident lines.
- Match the visual polish of top SaaS products (Stripe, Linear, Vercel, Notion).
- Output format: organise by file path. Show a brief file tree first, then code blocks tagged with the path (e.g. \`\`\`tsx title="app/page.tsx").
- Cite any third-party libraries you introduce and note install commands at the top of the README.`;

    const data = buildDataSection(
      slots,
      `Tech stack to use: ${techStack}
Audience: ${audience}`,
    );

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
