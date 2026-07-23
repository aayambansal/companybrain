import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadApiEnv } from './env.js';

const KEYS = [
  'CORS_ORIGINS',
  'AUTH_MODE',
  'API_HOST',
  'API_PORT',
  'PORT',
  'JWT_SECRET',
  'COMPANYBRAIN_VERSION',
  'ACCESS_TOKEN',
];

describe('loadApiEnv', () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('applies sensible defaults when nothing is set', () => {
    const env = loadApiEnv();
    expect(env.host).toBe('0.0.0.0');
    expect(env.port).toBe(3333);
    expect(env.corsOrigins).toEqual(['http://localhost:3000']);
    expect(env.authMode).toBe('single');
    expect(env.accessToken).toBeUndefined();
  });

  it('splits, trims, and drops empty CORS origins', () => {
    process.env.CORS_ORIGINS = 'https://a.com, https://b.com ,,https://c.com';
    expect(loadApiEnv().corsOrigins).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
  });

  it('only enables multi auth for the exact value "multi"', () => {
    process.env.AUTH_MODE = 'multi';
    expect(loadApiEnv().authMode).toBe('multi');
    process.env.AUTH_MODE = 'MULTI';
    expect(loadApiEnv().authMode).toBe('single');
    process.env.AUTH_MODE = 'anything';
    expect(loadApiEnv().authMode).toBe('single');
  });

  it('treats an empty access token as unset', () => {
    process.env.ACCESS_TOKEN = '';
    expect(loadApiEnv().accessToken).toBeUndefined();
    process.env.ACCESS_TOKEN = 'shared-secret';
    expect(loadApiEnv().accessToken).toBe('shared-secret');
  });

  it('parses the port as a number', () => {
    process.env.API_PORT = '8080';
    expect(loadApiEnv().port).toBe(8080);
  });

  it('falls back to the conventional PORT when API_PORT is unset', () => {
    process.env.PORT = '10000';
    expect(loadApiEnv().port).toBe(10000);
  });

  it('prefers API_PORT over PORT when both are set', () => {
    process.env.API_PORT = '3333';
    process.env.PORT = '10000';
    expect(loadApiEnv().port).toBe(3333);
  });
});
