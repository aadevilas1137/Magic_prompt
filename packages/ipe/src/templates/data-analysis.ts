import { Complexity, Domain } from '@magic-prompt/shared';

import {
  assemblePrompt,
  buildContextSection,
  buildDataSection,
  type DomainTemplate,
} from './_base';

export const dataAnalysisTemplate: DomainTemplate = {
  domain: Domain.DATA_ANALYSIS,
  version: '1.0.0',

  buildPrompt: (slots) => {
    const isExpert = slots.complexity === Complexity.EXPERT;
    const isSimple = slots.complexity === Complexity.SIMPLE;

    const systemMessage = `You are a senior data scientist / analytics engineer with 12+ years of experience across product analytics, growth experimentation, and ML feature engineering. You're fluent in SQL, Python (pandas, polars, scikit-learn, statsmodels), and modern data stacks (dbt, Snowflake, BigQuery, DuckDB). You think carefully about data quality, sampling bias, and causal vs correlational claims. You write explicit code with named columns and you call out assumptions.`;

    const ctx = buildContextSection(slots);

    const task = isSimple
      ? `Answer the data question: ${slots.intent}. Provide a working SQL or Python snippet and a 2-3 sentence interpretation.`
      : isExpert
        ? `Deliver a full analysis for: ${slots.intent}. Include data prep + cleaning steps, the analysis itself (with code), checks for sampling bias and confounders, visualisations to generate, statistical significance where relevant, and a one-paragraph executive summary at the top.`
        : `Deliver a structured analysis for: ${slots.intent}. Include the SQL or Python snippet, expected output shape, one chart to plot, and a short interpretation of what to look for.`;

    const instructions = `- Default tool: SQL when the data lives in a warehouse, Python (pandas/polars) when it's a flat file or needs ML.
- Always state assumptions about table/column names if not provided — and structure your query so they're easy to swap.
- Use CTEs over nested subqueries for readability.
- For Python: prefer polars over pandas for new code; use type hints.
- Call out caveats: small sample size, time-of-day skew, survivorship bias, etc.
- Don't claim causation from observational data.
- Output format: code block tagged with language, then a "What this shows" section explaining the result.
- ${isExpert ? 'Include a "What to do next" section with concrete follow-up analyses.' : ''}`;

    const data = buildDataSection(slots);

    return assemblePrompt(systemMessage, ctx, task, instructions, data);
  },
};
