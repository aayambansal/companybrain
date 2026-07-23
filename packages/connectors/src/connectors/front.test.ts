import { describe, it, expect } from 'vitest';
import { frontConversationDoc } from './front.js';

describe('frontConversationDoc', () => {
  const conv = {
    id: 'cnv_55c8c149',
    subject: 'Refund request',
    created_at: 1453770984.123,
    _links: { self: 'https://api2.frontapp.com/conversations/cnv_55c8c149' },
  };

  it('maps the fields onto a SourceDocument', () => {
    const doc = frontConversationDoc(conv);
    expect(doc.sourceId).toBe('cnv_55c8c149');
    expect(doc.sourceType).toBe('front_conversation');
    expect(doc.sourceUrl).toBe('https://api2.frontapp.com/conversations/cnv_55c8c149');
    expect(doc.title).toBe('Refund request');
    expect(doc.content).toBe('Refund request');
    expect(doc.tags).toEqual(['front']);
    expect(doc.sourceCreatedAt?.toISOString()).toBe('2016-01-26T01:16:24.123Z');
  });

  it('falls back to a default title when the subject is missing', () => {
    const doc = frontConversationDoc({ id: 'cnv_1' });
    expect(doc.title).toBe('Conversation');
    expect(doc.content).toBe('');
    expect(doc.sourceCreatedAt).toBeUndefined();
  });

  it('falls back to a default title when the subject is empty', () => {
    const doc = frontConversationDoc({ id: 'cnv_2', subject: '' });
    expect(doc.title).toBe('Conversation');
    expect(doc.content).toBe('');
  });
});
