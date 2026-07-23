import { describe, it, expect, vi } from 'vitest';
import { CompanyBrain, CompanyBrainError } from './index.js';

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const { status = 200, body } = handler(url.toString(), init ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (body === undefined ? '' : JSON.stringify(body)),
    } as Response;
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
    const fetchImpl = mockFetch(() => ({ status: 401, body: { error: 'unauthorized', message: 'nope' } }));
    const cb = new CompanyBrain({ fetch: fetchImpl });
    await expect(cb.memories.list()).rejects.toBeInstanceOf(CompanyBrainError);
    await expect(cb.memories.list()).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('normalizes the base url (no trailing slash)', () => {
    const cb = new CompanyBrain({ apiUrl: 'http://localhost:3333/', fetch: mockFetch(() => ({ body: {} })) });
    expect(cb.apiUrl).toBe('http://localhost:3333');
  });
});
