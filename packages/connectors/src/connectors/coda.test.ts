import { describe, it, expect } from 'vitest';
import { codaPageDoc } from './coda.js';

describe('codaPageDoc', () => {
  it('maps a page into a SourceDocument with name and link', () => {
    const doc = codaPageDoc({
      id: 'canvas-abc',
      name: 'Launch checklist',
      href: 'https://coda.io/apis/v1/docs/AbCd/pages/canvas-abc',
      browserLink: 'https://coda.io/d/_dAbCd/Launch-checklist_su123',
    });
    expect(doc.sourceId).toBe('canvas-abc');
    expect(doc.sourceType).toBe('coda');
    expect(doc.sourceUrl).toBe('https://coda.io/d/_dAbCd/Launch-checklist_su123');
    expect(doc.title).toBe('Launch checklist');
    expect(doc.content).toBe('Launch checklist');
    expect(doc.tags).toEqual(['coda']);
    expect(doc.metadata).toEqual({ id: 'canvas-abc' });
  });

  it('leaves sourceUrl undefined when browserLink is missing', () => {
    const doc = codaPageDoc({ id: 'canvas-def', name: 'Notes' });
    expect(doc.sourceUrl).toBeUndefined();
    expect(doc.title).toBe('Notes');
    expect(doc.content).toBe('Notes');
  });
});
