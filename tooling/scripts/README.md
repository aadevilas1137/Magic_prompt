# `@magic-prompt/scripts`

One-off TS scripts that run with `tsx`. No runtime deps — keep these scripts standalone so they work even before `pnpm install` finishes.

## Scripts

| File           | Run with         | Purpose                                              |
| -------------- | ---------------- | ---------------------------------------------------- |
| `check-env.ts` | `pnpm check-env` | Verify `apps/web/.env.local` covers the env contract |
