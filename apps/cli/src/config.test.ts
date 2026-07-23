import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConfig } from './config.js';

// resolveConfig reads process.env and, as a fallback, ~/.companybrain/config.json.
// These tests exercise the deterministic parts (env precedence, trailing-slash
// stripping) and stay robust to whether a real config file happens to exist.
describe('resolveConfig', () => {
  const saved = {
    url: process.env.COMPANYBRAIN_API_URL,
    key: process.env.COMPANYBRAIN_API_KEY,
  };
  beforeEach(() => {
    delete process.env.COMPANYBRAIN_API_URL;
    delete process.env.COMPANYBRAIN_API_KEY;
  });
  afterEach(() => {
    if (saved.url === undefined) delete process.env.COMPANYBRAIN_API_URL;
    else process.env.COMPANYBRAIN_API_URL = saved.url;
    if (saved.key === undefined) delete process.env.COMPANYBRAIN_API_KEY;
    else process.env.COMPANYBRAIN_API_KEY = saved.key;
  });

  it('lets env vars win and reports their source as env', () => {
    process.env.COMPANYBRAIN_API_URL = 'https://brain.example.com';
    process.env.COMPANYBRAIN_API_KEY = 'k_live_123';
    const c = resolveConfig();
    expect(c.apiUrl).toBe('https://brain.example.com');
    expect(c.apiKey).toBe('k_live_123');
    expect(c.sources.apiUrl).toBe('env');
    expect(c.sources.apiKey).toBe('env');
  });

  it('strips a trailing slash from the api url', () => {
    process.env.COMPANYBRAIN_API_URL = 'https://brain.example.com/';
    expect(resolveConfig().apiUrl).toBe('https://brain.example.com');
  });

  it('always resolves a non-empty, slash-free api url', () => {
    const c = resolveConfig();
    expect(c.apiUrl.length).toBeGreaterThan(0);
    expect(c.apiUrl).not.toMatch(/\/$/);
  });

  it('marks the api key unset (or from file) when no env key is present', () => {
    const c = resolveConfig();
    expect(['unset', 'config file']).toContain(c.sources.apiKey);
  });
});
