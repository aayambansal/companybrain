import { describe, it, expect } from 'vitest';
import { fathomCallDoc, parseFathomExport } from './fathom.js';

describe('fathomCallDoc', () => {
  it('builds a call document with summary, action items, and transcript', () => {
    const doc = fathomCallDoc(
      {
        id: 42,
        title: 'Acme discovery call',
        summary: 'Customer wants SSO.',
        action_items: ['Send pricing', 'Book follow-up'],
        transcript: 'Rep: what matters most? Buyer: security.',
        invitees: ['Rep', 'Buyer'],
        recorded_at: '2026-02-01T15:00:00Z',
        share_url: 'https://fathom.video/c/42',
      },
      0,
    );
    expect(doc).not.toBeNull();
    expect(doc!.sourceType).toBe('fathom_call');
    expect(doc!.content).toContain('Customer wants SSO.');
    expect(doc!.content).toContain('- Send pricing');
    expect(doc!.content).toContain('Rep: what matters most?');
    expect(doc!.tags).toEqual(['fathom', 'rep', 'buyer']);
    expect(doc!.sourceUrl).toBe('https://fathom.video/c/42');
    expect(doc!.metadata?.actionItems).toEqual(['Send pricing', 'Book follow-up']);
  });

  it('drops empty calls', () => {
    expect(fathomCallDoc({}, 0)).toBeNull();
  });
});

describe('parseFathomExport', () => {
  it('reads array and wrapper forms', () => {
    expect(parseFathomExport('[{"title":"a"}]')).toHaveLength(1);
    expect(parseFathomExport('{"recordings":[{"title":"a"}]}')).toHaveLength(1);
  });
});
