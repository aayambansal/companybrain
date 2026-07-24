import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { llmRateLimit, principalKey } from './llm-rate-limit.js';
import { resetEnv, type Variables, type AuthContext } from './context.js';

/** Build an app that pins a fixed principal then applies the limiter. */
function appFor(auth: AuthContext) {
  const app = new Hono<{ Variables: Variables }>();
  app.use('*', async (c, next) => {
    c.set('auth', auth);
    await next();
  });
  app.use('*', llmRateLimit);
  app.get('/', (c) => c.json({ ok: true }));
  return app;
}

describe('principalKey', () => {
  it('prefers the API key, then user, then org', () => {
    expect(
      principalKey({ orgId: 'o', userId: 'u', apiKeyId: 'k', scopes: [], via: 'apiKey' }),
    ).toBe('k');
    expect(principalKey({ orgId: 'o', userId: 'u', scopes: [], via: 'session' })).toBe('u');
    expect(principalKey({ orgId: 'o', scopes: [], via: 'single' })).toBe('o');
  });
});

describe('llmRateLimit middleware', () => {
  const saved = process.env.LLM_RATE_LIMIT_PER_MIN;
  beforeEach(() => resetEnv());
  afterEach(() => {
    if (saved === undefined) delete process.env.LLM_RATE_LIMIT_PER_MIN;
    else process.env.LLM_RATE_LIMIT_PER_MIN = saved;
    resetEnv();
  });

  it('allows requests up to the limit, then returns 429 with Retry-After', async () => {
    process.env.LLM_RATE_LIMIT_PER_MIN = '3';
    const app = appFor({ orgId: 'org-a', scopes: [], via: 'single' });

    for (let i = 0; i < 3; i++) {
      expect((await app.request('/')).status).toBe(200);
    }
    const blocked = await app.request('/');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await blocked.json()).error).toBe('rate_limited');
  });

  it('is disabled when the limit is 0', async () => {
    process.env.LLM_RATE_LIMIT_PER_MIN = '0';
    const app = appFor({ orgId: 'org-off', scopes: [], via: 'single' });
    for (let i = 0; i < 25; i++) {
      expect((await app.request('/')).status).toBe(200);
    }
  });

  it('budgets each principal independently', async () => {
    process.env.LLM_RATE_LIMIT_PER_MIN = '1';
    const a = appFor({ orgId: 'org-1', apiKeyId: 'key-1', scopes: [], via: 'apiKey' });
    const b = appFor({ orgId: 'org-1', apiKeyId: 'key-2', scopes: [], via: 'apiKey' });

    expect((await a.request('/')).status).toBe(200);
    expect((await a.request('/')).status).toBe(429); // key-1 exhausted
    expect((await b.request('/')).status).toBe(200); // key-2 unaffected
  });

  it('shares one budget across endpoints for the same principal', async () => {
    process.env.LLM_RATE_LIMIT_PER_MIN = '2';
    const auth: AuthContext = { orgId: 'org-shared', scopes: [], via: 'single' };
    const chat = appFor(auth); // stands in for /chat
    const playbooks = appFor(auth); // stands in for /playbooks

    expect((await chat.request('/')).status).toBe(200); // 1
    expect((await playbooks.request('/')).status).toBe(200); // 2
    expect((await chat.request('/')).status).toBe(429); // combined over 2
  });
});
