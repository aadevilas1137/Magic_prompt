# `@magic-prompt/shared`

Cross-cutting types, Zod schemas, error classes, and constants shared across every Magic Prompt package and app.

## Contents

- `errors/` — `AppError` class + canonical `ErrorCode` enum + HTTP status mapping
- `types/` — domain types (`User`, `Chat`, `Message`, pagination)
- `schemas/` — Zod schemas mirroring the types (used at API/form boundaries)
- `constants/` — `APP_NAME`, `Domain` taxonomy, locale list

## Usage

```ts
import { AppError, ErrorCode, UserSchema } from '@magic-prompt/shared';

throw new AppError({ code: ErrorCode.UNAUTHORIZED, message: 'no session' });

const user = UserSchema.parse(rawJson);
```

This package is source-only TypeScript and is transpiled by consumers (`apps/web` via `transpilePackages`).
