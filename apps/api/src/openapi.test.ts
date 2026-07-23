import { describe, it, expect } from 'vitest';
import { openapiDocument, docsPage } from './openapi.js';

describe('openapiDocument', () => {
  const doc = openapiDocument('9.9.9') as {
    openapi: string;
    info: { version: string };
    paths: Record<string, unknown>;
    components: { securitySchemes: Record<string, unknown> };
  };

  it('is a 3.x document with the passed version', () => {
    expect(doc.openapi.startsWith('3.')).toBe(true);
    expect(doc.info.version).toBe('9.9.9');
  });

  it('documents the core routes', () => {
    for (const p of [
      '/health',
      '/v1/memories',
      '/v1/search',
      '/v1/chat',
      '/v1/spaces',
      '/v1/api-keys',
    ]) {
      expect(doc.paths[p], `missing ${p}`).toBeTruthy();
    }
  });

  it('declares bearer auth', () => {
    expect(doc.components.securitySchemes.bearerAuth).toBeTruthy();
  });
});

describe('docsPage', () => {
  it('is a self-contained HTML doc that fetches the spec', () => {
    expect(docsPage).toContain('<!doctype html>');
    expect(docsPage).toContain('/v1/openapi.json');
    // No external stylesheet/script hosts (self-host friendly).
    expect(docsPage).not.toContain('http://');
    expect(docsPage).not.toContain('https://');
  });
});
