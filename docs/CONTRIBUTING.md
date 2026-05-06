# Contributing

Thanks for hacking on Magic Prompt AI. This document is short on purpose — read it once, then keep moving.

## Branch naming

```
<type>/<short-description>
```

`<type>` is one of: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci`, `perf`, `style`, `build`.

Examples: `feat/chat-composer`, `fix/auth-redirect`, `docs/adr-rate-limiting`.

## Commit messages

[Conventional Commits.](https://www.conventionalcommits.org/) `commitlint` enforces this on every `git commit` via Husky.

```
<type>(optional scope): <subject>

<body>

<footer>
```

Examples:

- `feat(chat): wire send button to /api/chat`
- `fix(auth): refresh session on tab focus`
- `docs(adr): add ADR-0006 for rate limiting`

## PR process

1. Open the PR against `main`.
2. The PR title follows the same Conventional Commits format as a commit.
3. Fill the description: what changed, why, screenshots/recordings if UI-touching, test plan.
4. CI must be green: `lint`, `typecheck`, `test --coverage`, `build`.
5. Code review by at least one engineer who didn't write the code. Self-reviews are not enough.
6. Squash-and-merge. The squash commit message uses the PR title.

## Local development checklist

Before opening a PR:

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passing
- [ ] `pnpm build` succeeds
- [ ] If UI-touching, manually walked the happy path **and** at least one error path in the browser
- [ ] If schema-touching, migrations generated **and** committed
- [ ] If env-touching, `.env.example` updated **and** the Zod schema in `apps/web/src/lib/env.ts` updated
- [ ] Docs updated (ADR if architectural, README if scripts/setup, JSDoc if public API)

## Definition of done

A change is _done_ when the code is merged, the deploy is green, and a teammate could understand both _what_ changed and _why_ by reading the PR alone in six months.
