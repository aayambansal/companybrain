import { describe, it, expect } from 'vitest';
import { gitlabIssueDoc } from './gitlab.js';

describe('gitlabIssueDoc', () => {
  it('maps an issue with a description', () => {
    const doc = gitlabIssueDoc({
      id: 4001,
      iid: 42,
      title: 'Add GitLab connector',
      description: 'Index a project\'s issues into the brain.',
      web_url: 'https://gitlab.com/group/project/-/issues/42',
      updated_at: '2024-03-01T12:30:00.000Z',
    });
    expect(doc.sourceId).toBe('4001');
    expect(doc.sourceType).toBe('gitlab_issue');
    expect(doc.sourceUrl).toBe('https://gitlab.com/group/project/-/issues/42');
    expect(doc.title).toBe('#42 Add GitLab connector');
    expect(doc.content).toBe('Add GitLab connector\n\nIndex a project\'s issues into the brain.');
    expect(doc.tags).toEqual(['gitlab']);
    expect(doc.sourceUpdatedAt).toBeInstanceOf(Date);
    expect(doc.sourceUpdatedAt?.toISOString()).toBe('2024-03-01T12:30:00.000Z');
  });

  it('maps an issue with no description to just its title', () => {
    const doc = gitlabIssueDoc({
      id: 4002,
      iid: 7,
      title: 'A title with no body',
      web_url: 'https://gitlab.com/group/project/-/issues/7',
    });
    expect(doc.title).toBe('#7 A title with no body');
    expect(doc.content).toBe('A title with no body');
    expect(doc.tags).toEqual(['gitlab']);
    expect(doc.sourceUpdatedAt).toBeUndefined();
  });
});
