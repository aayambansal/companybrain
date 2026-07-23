import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestSignal, fetchJson, fetchText } from './http.js';

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
