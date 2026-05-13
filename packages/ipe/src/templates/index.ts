import { Domain } from '@magic-prompt/shared';

import { contentWritingTemplate } from './content-writing';
import { dataAnalysisTemplate } from './data-analysis';
import { educationTemplate } from './education';
import { generalTemplate } from './general';
import { healthcareTemplate } from './healthcare';
import { hrTemplate } from './hr';
import { legalTemplate } from './legal';
import { marketingTemplate } from './marketing';
import { realEstateTemplate } from './real-estate';
import { webDevelopmentTemplate } from './web-development';

import type { DomainTemplate } from './_base';

/**
 * Domain → template registry. Layer 3 (Magic Prompt Constructor) looks up
 * the template for the classifier's `primary_domain` and falls back to
 * `generalTemplate` if the classifier returned an unknown value (shouldn't
 * happen — Zod enforces the enum — but defence in depth).
 */
export const TEMPLATE_REGISTRY: Readonly<Record<Domain, DomainTemplate>> = {
  [Domain.WEB_DEVELOPMENT]: webDevelopmentTemplate,
  [Domain.REAL_ESTATE]: realEstateTemplate,
  [Domain.CONTENT_WRITING]: contentWritingTemplate,
  [Domain.MARKETING]: marketingTemplate,
  [Domain.DATA_ANALYSIS]: dataAnalysisTemplate,
  [Domain.EDUCATION]: educationTemplate,
  [Domain.LEGAL]: legalTemplate,
  [Domain.HEALTHCARE]: healthcareTemplate,
  [Domain.HR]: hrTemplate,
  [Domain.GENERAL]: generalTemplate,
};

export function getTemplate(domain: Domain): DomainTemplate {
  return TEMPLATE_REGISTRY[domain] ?? generalTemplate;
}

export { generalTemplate };
export type { DomainTemplate };
