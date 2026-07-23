import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from './config.js';

const KEYS = [
  'EMBEDDING_PROVIDER',
  'EMBEDDING_MODEL',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'ENRICH_ON_INGEST',
  'TEMPORAL_RESOLUTION',
  'TEMPORAL_CANDIDATES',
  'HYDE_SAMPLES',
  'RRF_VECTOR_WEIGHT',
  'RRF_KEYWORD_WEIGHT',
  'CHUNK_TARGET_TOKENS',
];

let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('loadConfig', () => {
  it('applies sensible defaults with no env set', () => {
    const c = loadConfig();
    expect(c.embedding.provider).toBe('local');
    expect(c.llm.provider).toBe('anthropic');
    expect(c.enrich.enabled).toBe(true);
    expect(c.temporal.enabled).toBe(false);
    expect(c.hyde.samples).toBe(1);
    expect(c.rrf).toEqual({ vectorWeight: 2, keywordWeight: 1 });
  });

  it('reads env vars, including booleans and integers', () => {
    process.env.EMBEDDING_PROVIDER = 'openai';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
    process.env.TEMPORAL_RESOLUTION = 'true';
    process.env.HYDE_SAMPLES = '3';
    process.env.RRF_VECTOR_WEIGHT = '4';
    process.env.ENRICH_ON_INGEST = 'false';
    const c = loadConfig();
    expect(c.embedding.provider).toBe('openai');
    expect(c.embedding.model).toBe('text-embedding-3-large');
    expect(c.temporal.enabled).toBe(true);
    expect(c.hyde.samples).toBe(3);
    expect(c.rrf.vectorWeight).toBe(4);
    expect(c.enrich.enabled).toBe(false);
  });

  it('falls back to defaults for non-numeric integer env values', () => {
    process.env.HYDE_SAMPLES = 'not-a-number';
    expect(loadConfig().hyde.samples).toBe(1);
  });

  it('lets the overrides argument win over env and defaults', () => {
    process.env.LLM_PROVIDER = 'openai';
    const c = loadConfig({ llm: { provider: 'none', model: 'x', ollamaBaseUrl: '' } });
    expect(c.llm.provider).toBe('none');
  });
});
