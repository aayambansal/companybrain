import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestSignal, fetchJson, fetchText, retryDelayMs, redactUrl } from './http.js';

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

describe('SSRF guard', () => {
  const savedAuth = process.env.AUTH_MODE;
  const savedAllow = process.env.CONNECTOR_ALLOW_INTERNAL;
  afterEach(() => {
    if (savedAuth === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = savedAuth;
    if (savedAllow === undefined) delete process.env.CONNECTOR_ALLOW_INTERNAL;
    else process.env.CONNECTOR_ALLOW_INTERNAL = savedAllow;
  });

  it('refuses internal targets when blocking is enabled, without fetching', async () => {
    process.env.CONNECTOR_ALLOW_INTERNAL = 'false';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(fetchText('http://127.0.0.1:9200/_search')).rejects.toThrow(/internal or private/);
    await expect(fetchJson('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/internal/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('re-checks redirect hops and refuses a redirect into an internal address', async () => {
    process.env.CONNECTOR_ALLOW_INTERNAL = 'false';
    // A public start (literal public IP, no DNS) that 302s to the metadata endpoint.
    const fetchSpy = vi.fn(
      async () =>
        ({
          status: 302,
          ok: false,
          headers: {
            get: (h: string) =>
              h.toLowerCase() === 'location' ? 'http://169.254.169.254/latest/meta-data' : null,
          },
          text: async () => '',
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(fetchText('http://93.184.216.34/start')).rejects.toThrow(/internal or private/);
    // The public hop is fetched once; the internal redirect target is refused
    // before a second fetch, so redirect:'follow' can't chase it.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does not block when internal targets are allowed', async () => {
    process.env.CONNECTOR_ALLOW_INTERNAL = 'true';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => 'ok' }) as Response),
    );
    expect(await fetchText('http://127.0.0.1/local')).toBe('ok');
  });

  it('is off by default outside multi-tenant mode', async () => {
    delete process.env.CONNECTOR_ALLOW_INTERNAL;
    delete process.env.AUTH_MODE;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => 'ok' }) as Response),
    );
    expect(await fetchText('http://127.0.0.1/local')).toBe('ok');
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

describe('redactUrl', () => {
  it('redacts credential-looking query params (so tokens do not leak into errors)', () => {
    expect(redactUrl('https://x.com/api?api_token=SECRET&limit=100')).toBe(
      'https://x.com/api?api_token=REDACTED&limit=100',
    );
    expect(redactUrl('https://x.com/a?access_token=abc&key=def&secret=ghi')).toBe(
      'https://x.com/a?access_token=REDACTED&key=REDACTED&secret=REDACTED',
    );
  });

  it('leaves non-sensitive params intact', () => {
    expect(redactUrl('https://x.com/api?limit=100&start=5')).toBe(
      'https://x.com/api?limit=100&start=5',
    );
  });

  it('drops the query string when the URL is not parseable', () => {
    expect(redactUrl('not a url?token=SECRET')).toBe('not a url');
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
