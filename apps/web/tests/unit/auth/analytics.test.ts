import { describe, expect, it, vi } from 'vitest';

import {
  anonDistinctId,
  compactProperties,
  getEmailDomain,
  trackAuthEvent,
} from '@/features/auth/lib/analytics';

describe('getEmailDomain', () => {
  it('extracts the domain from a normal email', () => {
    expect(getEmailDomain('user@gmail.com')).toBe('gmail.com');
    expect(getEmailDomain('first.last+tag@example.co.uk')).toBe('example.co.uk');
  });

  it('lowercases the domain', () => {
    expect(getEmailDomain('USER@GMAIL.COM')).toBe('gmail.com');
    expect(getEmailDomain('user@MixedCase.Org')).toBe('mixedcase.org');
  });

  it('trims surrounding whitespace in the domain part', () => {
    expect(getEmailDomain('user@  gmail.com  ')).toBe('gmail.com');
  });

  it('uses the last @ for emails with multiple @ characters', () => {
    expect(getEmailDomain('weird@local@example.com')).toBe('example.com');
  });

  it('returns undefined for non-string input', () => {
    expect(getEmailDomain(undefined)).toBeUndefined();
    expect(getEmailDomain(null)).toBeUndefined();
    expect(getEmailDomain(123)).toBeUndefined();
    expect(getEmailDomain({})).toBeUndefined();
  });

  it('returns undefined when there is no @', () => {
    expect(getEmailDomain('no-at-sign')).toBeUndefined();
    expect(getEmailDomain('')).toBeUndefined();
  });

  it('returns undefined when @ is at the start (no local part)', () => {
    expect(getEmailDomain('@gmail.com')).toBeUndefined();
  });

  it('returns undefined when @ is at the end (no domain)', () => {
    expect(getEmailDomain('user@')).toBeUndefined();
  });

  it('returns undefined when domain is whitespace only', () => {
    expect(getEmailDomain('user@   ')).toBeUndefined();
  });
});

describe('anonDistinctId', () => {
  it('prefixes the IP with anon:', () => {
    expect(anonDistinctId('1.2.3.4')).toBe('anon:1.2.3.4');
  });

  it('falls back to anon:unknown when ip is empty', () => {
    expect(anonDistinctId('')).toBe('anon:unknown');
  });
});

describe('compactProperties', () => {
  it('drops keys whose values are undefined', () => {
    expect(compactProperties({ a: 1, b: undefined, c: 'x' })).toEqual({ a: 1, c: 'x' });
  });

  it('keeps null, 0, false, empty string', () => {
    expect(compactProperties({ a: null, b: 0, c: false, d: '' })).toEqual({
      a: null,
      b: 0,
      c: false,
      d: '',
    });
  });

  it('returns an empty object when all values are undefined', () => {
    expect(compactProperties({ a: undefined, b: undefined })).toEqual({});
  });
});

describe('trackAuthEvent', () => {
  it('does not throw when called with no PostHog key configured', () => {
    expect(() =>
      trackAuthEvent({
        distinctId: 'anon:1.2.3.4',
        event: 'auth.login.attempted',
        properties: { emailDomain: 'gmail.com' },
      }),
    ).not.toThrow();
  });

  it('does not throw when called with no properties', () => {
    expect(() =>
      trackAuthEvent({ distinctId: 'anon:1.2.3.4', event: 'auth.logout' }),
    ).not.toThrow();
  });

  it('swallows errors from the analytics layer', async () => {
    vi.resetModules();
    vi.doMock('@magic-prompt/analytics', () => ({
      track: () => {
        throw new Error('posthog exploded');
      },
    }));
    const { trackAuthEvent: trackWithBrokenAnalytics } =
      await import('@/features/auth/lib/analytics');
    expect(() =>
      trackWithBrokenAnalytics({ distinctId: 'x', event: 'auth.login.attempted' }),
    ).not.toThrow();
    vi.doUnmock('@magic-prompt/analytics');
    vi.resetModules();
  });
});
