import { describe, it, expect } from 'vitest';
import { timeAgo, hostname } from './format';

describe('timeAgo', () => {
  it('reads the current moment and future timestamps as "just now"', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
    expect(timeAgo(new Date(Date.now() + 60_000).toISOString())).toBe('just now');
  });

  it('formats seconds, minutes, hours, and days', () => {
    expect(timeAgo(new Date(Date.now() - 5_000).toISOString())).toMatch(/^[45]s ago$/);
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe('2d ago');
  });

  it('returns "unknown" for an invalid date instead of "NaNs ago"', () => {
    expect(timeAgo('not-a-date')).toBe('unknown');
    expect(timeAgo('')).toBe('unknown');
  });
});

describe('hostname', () => {
  it('strips the protocol and a leading www', () => {
    expect(hostname('https://www.example.com/path?q=1')).toBe('example.com');
    expect(hostname('http://docs.example.com')).toBe('docs.example.com');
  });

  it('returns null for null or an unparseable url', () => {
    expect(hostname(null)).toBeNull();
    expect(hostname('not a url')).toBeNull();
  });
});
