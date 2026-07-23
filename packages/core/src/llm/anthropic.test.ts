import { describe, it, expect, vi, afterEach } from 'vitest';
import { AnthropicProvider } from './anthropic.js';

afterEach(() => vi.unstubAllGlobals());

function textResponse(text: string) {
  return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }] }) } as any;
}
function tempError() {
  const body = JSON.stringify({ error: { message: '`temperature` is deprecated for this model.' } });
  return { ok: false, status: 400, text: async () => body, clone: () => ({ text: async () => body }) } as any;
}

describe('AnthropicProvider temperature fallback', () => {
  it('retries without temperature when the model rejects it', async () => {
    const bodies: any[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return tempError(); })
      .mockImplementationOnce(async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return textResponse('ok'); });
    vi.stubGlobal('fetch', fetchMock);

    const p = new AnthropicProvider({ apiKey: 'sk-x', model: 'claude-sonnet-5' });
    const out = await p.complete({ messages: [{ role: 'user', content: 'hi' }], temperature: 0 });
    expect(out).toBe('ok');
    expect('temperature' in bodies[0]).toBe(true); // first attempt included it
    expect('temperature' in bodies[1]).toBe(false); // retry dropped it
  });

  it('stops sending temperature on subsequent calls once rejected', async () => {
    const bodies: any[] = [];
    const fetchMock = vi.fn(async (_u: string, init: any) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      return 'temperature' in body ? tempError() : textResponse('ok');
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = new AnthropicProvider({ apiKey: 'sk-x', model: 'claude-sonnet-5' });
    await p.complete({ messages: [{ role: 'user', content: 'a' }] });
    await p.complete({ messages: [{ role: 'user', content: 'b' }] });
    // First call: with-temp (400) then without (ok) = 2 bodies. Second call: without-temp only = 1.
    const withTemp = bodies.filter((b) => 'temperature' in b).length;
    expect(withTemp).toBe(1);
  });
});
