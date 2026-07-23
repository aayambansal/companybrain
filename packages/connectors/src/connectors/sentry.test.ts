import { describe, it, expect } from 'vitest';
import { sentryIssueDoc } from './sentry.js';

describe('sentryIssueDoc', () => {
  it('maps an issue with a culprit', () => {
    const doc = sentryIssueDoc({
      id: '99',
      title: 'TypeError: cannot read property',
      culprit: 'app/main in render',
      permalink: 'https://sentry.io/organizations/acme/issues/99/',
      lastSeen: '2024-06-01T10:00:00.000Z',
      count: 42,
    });
    expect(doc.sourceId).toBe('99');
    expect(doc.sourceType).toBe('sentry_issue');
    expect(doc.sourceUrl).toBe('https://sentry.io/organizations/acme/issues/99/');
    expect(doc.title).toBe('TypeError: cannot read property');
    expect(doc.content).toBe('TypeError: cannot read property\n\napp/main in render\n\nseen 42 times');
    expect(doc.tags).toEqual(['sentry']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2024-06-01T10:00:00.000Z');
  });

  it('maps an issue with no culprit', () => {
    const doc = sentryIssueDoc({
      id: '100',
      title: 'Timeout error',
      permalink: 'https://sentry.io/organizations/acme/issues/100/',
      count: 1,
    });
    expect(doc.title).toBe('Timeout error');
    expect(doc.content).toBe('Timeout error\n\nseen 1 times');
    expect(doc.tags).toEqual(['sentry']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
