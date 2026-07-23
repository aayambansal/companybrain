import { describe, it, expect } from 'vitest';
import { redditPostToDoc } from './reddit.js';

describe('redditPostToDoc', () => {
  it('maps a self-post to a document', () => {
    const doc = redditPostToDoc({
      data: {
        id: 'abc123',
        title: 'How we self-host our memory',
        selftext: 'We run everything on a single box and it is great.',
        url: 'https://www.reddit.com/r/programming/comments/abc123/how_we_self_host/',
        permalink: '/r/programming/comments/abc123/how_we_self_host/',
        created_utc: 1_700_000_000,
        subreddit: 'programming',
        author: 'ada',
      },
    });
    expect(doc).not.toBeNull();
    expect(doc!.sourceId).toBe('abc123');
    expect(doc!.sourceType).toBe('reddit');
    expect(doc!.sourceUrl).toBe(
      'https://www.reddit.com/r/programming/comments/abc123/how_we_self_host/',
    );
    expect(doc!.title).toBe('How we self-host our memory');
    expect(doc!.content).toContain('How we self-host our memory');
    expect(doc!.content).toContain('We run everything on a single box');
    expect(doc!.tags).toEqual(['reddit', 'programming']);
    expect(doc!.metadata?.author).toBe('ada');
    expect(doc!.sourceCreatedAt).toBeInstanceOf(Date);
    expect(doc!.sourceCreatedAt?.toISOString()).toBe('2023-11-14T22:13:20.000Z');
  });

  it('maps a link-post with no body to just its title', () => {
    const doc = redditPostToDoc({
      data: {
        id: 'link1',
        title: 'A great article about databases',
        selftext: '',
        url: 'https://example.com/databases',
        permalink: '/r/databases/comments/link1/a_great_article/',
        created_utc: 1_700_000_500,
        subreddit: 'databases',
        author: 'grace',
      },
    });
    expect(doc).not.toBeNull();
    expect(doc!.content).toBe('A great article about databases');
    expect(doc!.sourceUrl).toBe(
      'https://www.reddit.com/r/databases/comments/link1/a_great_article/',
    );
    expect(doc!.metadata?.url).toBe('https://example.com/databases');
    expect(doc!.tags).toEqual(['reddit', 'databases']);
  });

  it('returns null for a post missing a title', () => {
    expect(redditPostToDoc({ data: { id: 'x', selftext: 'orphan body' } })).toBeNull();
    expect(redditPostToDoc({})).toBeNull();
  });
});
