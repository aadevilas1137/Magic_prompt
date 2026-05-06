# `@magic-prompt/ipe`

Iterative Prompt Engineering pipeline. **Phase 1 is interfaces + stubs only.**

## The seven layers

1. `parse` — tokenize / segment the raw input
2. `classify` — domain + complexity + intent
3. `enrich` — pull domain knowledge / examples
4. `rewrite` — produce the candidate "magic prompt"
5. `critique` — model self-evaluation
6. `refine` — apply critique
7. `finalize` — emit final prompt + metadata

Layer implementations land in Phases 4–7. The Phase 1 `StubIPEPipeline.execute()` always throws `AppError(NOT_IMPLEMENTED)` — useful only to wire types end-to-end.
