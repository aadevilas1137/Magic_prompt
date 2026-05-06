# `@magic-prompt/ui`

Shared UI primitives for Magic Prompt AI.

In Phase 1 this exposes only the `cn()` helper and the Tailwind preset host. shadcn/ui components are added on demand directly in `apps/web` (per shadcn's recommended pattern). Components that genuinely need to be shared across multiple apps will be promoted into this package with a deliberate review.

## Usage

```tsx
import { cn } from '@magic-prompt/ui';

<div className={cn('rounded-lg p-4', isActive && 'bg-primary')} />;
```
