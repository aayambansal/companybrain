import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestSignal, fetchJson, fetchText, retryDelayMs } from './http.js';

afterEach(() => vi.unstubAllGlobals());

describe('requestSignal', () => {
  it('returns an AbortSignal when no caller signal is given', () => {
    expect(requestSignal(undefined, 1000)).toBeInstanceOf(AbortSignal);
  });
  it('combines a caller signal with the timeout', () => {
    const ctrl = new AbortController();
    const sig = requestSignal(ctrl.signal, 1000);
    expect(sig).toBeInstanceOf(AbortSignal);
    // Aborting the caller aborts the combined signal.
    ctrl.abort();
    expect(sig.aborted).toBe(true);
  });
});

describe('fetchJson', () => {
  it('always passes an abort signal and parses JSON on success', async () => {
    let sawSignal = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sawSignal = init.signal instanceof AbortSignal;
        return { ok: true, json: async () => ({ hello: 'world' }) } as Response;
      }),
    );
    const out = await fetchJson<{ hello: string }>('https://x/y');
    expect(out.hello).toBe('world');
    expect(sawSignal).toBe(true);
  });

  it('throws on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({ ok: false, status: 500, statusText: 'err', text: async () => 'boom' }) as Response,
      ),
    );
    await expect(fetchJson('https://x/y')).rejects.toThrow(/500/);
  });
});

describe('fetchText', () => {
  it('returns the body text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => 'hi' }) as Response),
    );
    expect(await fetchText('https://x/y')).toBe('hi');
  });
});

describe('retryDelayMs', () => {
  it('honors a numeric Retry-After in seconds', () => {
    expect(retryDelayMs('2', 0)).toBe(2000);
  });

  it('caps an excessive Retry-After', () => {
    expect(retryDelayMs('99999', 0)).toBe(60_000);
  });

  it('uses exponential backoff when Retry-After is absent', () => {
    expect(retryDelayMs(null, 0)).toBe(1000);
    expect(retryDelayMs(null, 2)).toBe(4000);
  });
});

describe('fetchJson rate-limit retry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('retries a 429 honoring Retry-After, then returns the body', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            headers: new Headers({ 'retry-after': '0' }),
            text: async () => 'slow down',
          } as Response;
        }
        return { ok: true, status: 200, json: async () => ({ done: true }) } as Response;
      }),
    );

    const res = await fetchJson<{ done: boolean }>('https://api.test/x');
    expect(res).toEqual({ done: true });
    expect(calls).toBe(2);
  });
});
