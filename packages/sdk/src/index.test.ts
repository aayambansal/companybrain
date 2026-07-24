import { describe, it, expect, vi } from 'vitest';
import { CompanyBrain, CompanyBrainError, parseRetryAfter } from './index.js';

function mockFetch(
  handler: (
    url: string,
    init: RequestInit,
  ) => { status?: number; body: unknown; headers?: Record<string, string> },
) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body, headers = {} } = handler(url.toString(), init ?? {});
    const lower: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('CompanyBrain SDK', () => {
  it('sends the API key as a bearer token', async () => {
    let seenAuth: string | undefined;
    const fetchImpl = mockFetch((_url, init) => {
      seenAuth = (init.headers as Record<string, string>)['Authorization'];
      return { body: { memory: { id: 'm1', status: 'indexed' } } };
    });
    const cb = new CompanyBrain({ apiKey: 'cb_test_123', fetch: fetchImpl });
    const mem = await cb.memories.add({ content: 'hello' });
    expect(seenAuth).toBe('Bearer cb_test_123');
    expect(mem.id).toBe('m1');
  });

  it('builds query params for search', async () => {
    let seenUrl = '';
    const fetchImpl = mockFetch((url) => {
      seenUrl = url;
      return { body: { query: 'ship', mode: 'hybrid', hits: [], tookMs: 1 } };
    });
    const cb = new CompanyBrain({ apiUrl: 'http://x:1/', fetch: fetchImpl });
    const res = await cb.search({ q: 'ship', mode: 'hybrid' });
    expect(res.mode).toBe('hybrid');
    expect(seenUrl).toBe('http://x:1/v1/search');
  });

  it('posts a playbook request', async () => {
    let seenUrl = '';
    let seenBody: unknown;
    const fetchImpl = mockFetch((url, init) => {
      seenUrl = url;
      seenBody = init.body ? JSON.parse(String(init.body)) : undefined;
      return { body: { playbook: { title: 'Shipping', content: '# Shipping', citations: [] } } };
    });
    const cb = new CompanyBrain({ apiUrl: 'http://x:1', fetch: fetchImpl });
    const res = await cb.playbook({ topic: 'shipping' });
    expect(seenUrl).toBe('http://x:1/v1/playbooks');
    expect(seenBody).toMatchObject({ topic: 'shipping' });
    expect(res.playbook.title).toBe('Shipping');
  });

  it('builds a topics query', async () => {
    let seenUrl = '';
    const fetchImpl = mockFetch((url) => {
      seenUrl = url;
      return { body: { topics: [{ topic: 'launch', count: 3, sample: [] }] } };
    });
    const cb = new CompanyBrain({ apiUrl: 'http://x:1', fetch: fetchImpl });
    const res = await cb.topics({ minCount: 2 });
    expect(seenUrl).toContain('/v1/topics');
    expect(seenUrl).toContain('minCount=2');
    expect(res.topics[0]?.topic).toBe('launch');
  });

  it('throws a typed error on non-2xx', async () => {
    const fetchImpl = mockFetch(() => ({
      status: 401,
      body: { error: 'unauthorized', message: 'nope' },
    }));
    const cb = new CompanyBrain({ fetch: fetchImpl });
    await expect(cb.memories.list()).rejects.toBeInstanceOf(CompanyBrainError);
    await expect(cb.memories.list()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('surfaces Retry-After from a 429 as retryAfter seconds', async () => {
    const fetchImpl = mockFetch(() => ({
      status: 429,
      headers: { 'Retry-After': '42' },
      body: { error: 'rate_limited', message: 'LLM rate limit reached (60/min). Retry in 42s.' },
    }));
    const cb = new CompanyBrain({ fetch: fetchImpl, maxRetries: 0 });
    await expect(cb.chat({ message: 'hi' })).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      retryAfter: 42,
    });
  });

  it('retries a 429 (honoring Retry-After) then returns the success', async () => {
    let calls = 0;
    const fetchImpl = mockFetch(() => {
      calls += 1;
      if (calls === 1) return { status: 429, headers: { 'Retry-After': '0' }, body: {} };
      return { body: { message: 'ok', citations: [] } };
    });
    const cb = new CompanyBrain({ fetch: fetchImpl, maxRetries: 2 });
    const res = await cb.chat({ message: 'hi' });
    expect(res.message).toBe('ok');
    expect(calls).toBe(2);
  });

  it('gives up after maxRetries and throws the rate-limit error', async () => {
    let calls = 0;
    const fetchImpl = mockFetch(() => {
      calls += 1;
      return { status: 429, headers: { 'Retry-After': '0' }, body: { error: 'rate_limited' } };
    });
    const cb = new CompanyBrain({ fetch: fetchImpl, maxRetries: 2 });
    await expect(cb.search({ q: 'x' })).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(3); // initial + 2 retries
  });

  it('parses Retry-After seconds, ignoring garbage and honoring absence', () => {
    expect(parseRetryAfter('42')).toBe(42);
    expect(parseRetryAfter('  7 ')).toBe(7);
    expect(parseRetryAfter('0')).toBe(0);
    expect(parseRetryAfter('5abc')).toBeUndefined();
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
  });

  it('normalizes the base url (no trailing slash)', () => {
    const cb = new CompanyBrain({
      apiUrl: 'http://localhost:3333/',
      fetch: mockFetch(() => ({ body: {} })),
    });
    expect(cb.apiUrl).toBe('http://localhost:3333');
  });
});

/** A Response whose body streams the given string chunks as an SSE ReadableStream. */
function streamResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]));
      else controller.close();
    },
  });
  return { ok: true, status: 200, body } as unknown as Response;
}

describe('CompanyBrain SDK chatStream', () => {
  it('parses SSE frames, reassembling one split across two reads', async () => {
    const fetchImpl = vi.fn(async () =>
      streamResponse([
        'event: citations\ndata: [{"index":1}]\n\n',
        'event: token\ndata: "Hel', // frame split mid-value
        'lo world"\n\nevent: token\ndata: " again"\n\n',
        'event: done\ndata: 1\n\n',
      ]),
    ) as unknown as typeof fetch;
    const cb = new CompanyBrain({ fetch: fetchImpl });

    const frames: { event: string; data: string }[] = [];
    for await (const f of cb.chatStream({ message: 'hi' })) frames.push(f);

    expect(frames[0]).toEqual({ event: 'citations', data: '[{"index":1}]' });
    // The split frame is buffered and reassembled; the JSON-encoded token keeps
    // its whitespace inside the quotes so consumers can JSON.parse it losslessly.
    expect(frames[1]).toEqual({ event: 'token', data: '"Hello world"' });
    expect(JSON.parse(frames[2]!.data)).toBe(' again');
    expect(frames.some((f) => f.event === 'done')).toBe(true);
  });

  it('throws a typed error when the stream response is not ok', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 500,
          body: null,
          headers: { get: () => null },
          text: async () => '',
        }) as unknown as Response,
    ) as unknown as typeof fetch;
    const cb = new CompanyBrain({ fetch: fetchImpl });
    await expect(async () => {
      for await (const _ of cb.chatStream({ message: 'hi' })) void _;
    }).rejects.toBeInstanceOf(CompanyBrainError);
  });

  it('surfaces a 429 with retryAfter on a rate-limited stream', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          ok: false,
          status: 429,
          headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? '30' : null) },
          text: async () => JSON.stringify({ error: 'rate_limited', message: 'slow down' }),
        }) as unknown as Response,
    ) as unknown as typeof fetch;
    const cb = new CompanyBrain({ fetch: fetchImpl });
    await expect(async () => {
      for await (const _ of cb.chatStream({ message: 'hi' })) void _;
    }).rejects.toMatchObject({ status: 429, code: 'rate_limited', retryAfter: 30 });
  });
});
