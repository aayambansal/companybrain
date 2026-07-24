import { describe, it, expect, vi } from 'vitest';
import { waitForDatabase } from './wait.js';

describe('waitForDatabase', () => {
  it('returns true as soon as a ping succeeds', async () => {
    const ping = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ok = await waitForDatabase({ connectionString: 'x', ping, sleep, attempts: 5 });
    expect(ok).toBe(true);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries with a delay until the database answers', async () => {
    const ping = vi
      .fn()
      .mockRejectedValueOnce(new Error('refused'))
      .mockRejectedValueOnce(new Error('refused'))
      .mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ok = await waitForDatabase({ connectionString: 'x', ping, sleep, attempts: 5 });
    expect(ok).toBe(true);
    expect(ping).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('gives up after the configured attempts', async () => {
    const ping = vi.fn().mockRejectedValue(new Error('refused'));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const ok = await waitForDatabase({ connectionString: 'x', ping, sleep, attempts: 3 });
    expect(ok).toBe(false);
    expect(ping).toHaveBeenCalledTimes(3);
    // No sleep after the final failed attempt.
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('returns false with no connection string', async () => {
    expect(await waitForDatabase({ connectionString: '' })).toBe(false);
  });
});
