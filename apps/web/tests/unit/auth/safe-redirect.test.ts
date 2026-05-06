import { describe, expect, it } from 'vitest';

import { SAFE_REDIRECT_DEFAULT, safeRedirect } from '@/features/auth/lib/safe-redirect';

describe('safeRedirect', () => {
  it('returns valid relative paths as-is', () => {
    expect(safeRedirect('/chat')).toBe('/chat');
    expect(safeRedirect('/settings/profile')).toBe('/settings/profile');
    expect(safeRedirect('/chat?session=abc')).toBe('/chat?session=abc');
  });

  it('returns the fallback for null / undefined / non-strings', () => {
    expect(safeRedirect(null)).toBe(SAFE_REDIRECT_DEFAULT);
    expect(safeRedirect(undefined)).toBe(SAFE_REDIRECT_DEFAULT);
    expect(safeRedirect('')).toBe(SAFE_REDIRECT_DEFAULT);
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirect('https://evil.com')).toBe(SAFE_REDIRECT_DEFAULT);
    expect(safeRedirect('http://evil.com')).toBe(SAFE_REDIRECT_DEFAULT);
  });

  it('rejects protocol-relative URLs (//evil.com → escapes origin)', () => {
    expect(safeRedirect('//evil.com')).toBe(SAFE_REDIRECT_DEFAULT);
    expect(safeRedirect('//evil.com/phish')).toBe(SAFE_REDIRECT_DEFAULT);
  });

  it('rejects backslash-escaped paths (some browsers normalise these)', () => {
    expect(safeRedirect('/\\evil.com')).toBe(SAFE_REDIRECT_DEFAULT);
  });

  it('rejects javascript: and data: pseudo-schemes', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe(SAFE_REDIRECT_DEFAULT);
    expect(safeRedirect('data:text/html,<script>alert(1)</script>')).toBe(SAFE_REDIRECT_DEFAULT);
  });

  it('respects the caller-supplied fallback', () => {
    expect(safeRedirect(null, '/login')).toBe('/login');
    expect(safeRedirect('https://evil.com', '/login')).toBe('/login');
  });
});
