import 'server-only';

import { env } from '@/lib/env';

/**
 * Admin gate for the `?showMagic=1` debug panel.
 *
 * Phase 8 RBAC will replace this with a real role check. For now we read
 * a comma-separated allowlist from `IPE_ADMIN_EMAILS` (default contains
 * the project owner so dev workflow doesn't need extra config).
 *
 * Returns false when:
 *   - IPE_DEBUG_MODE is off (defence in depth — even if a request slips
 *     through with `?showMagic=1`, the debug panel is hidden).
 *   - The admin email list is empty (production hardening).
 *   - The user's email isn't in the list (case-insensitive match).
 */
export function isIPEAdmin(email: string | null | undefined): boolean {
  if (!env.IPE_DEBUG_MODE) return false;
  if (!email) return false;
  if (env.IPE_ADMIN_EMAILS.length === 0) return false;
  return env.IPE_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
