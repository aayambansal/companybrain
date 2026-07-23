import { describe, it, expect } from 'vitest';
import { extractYoutubeId, parseTimedText } from './youtube.js';

describe('extractYoutubeId', () => {
  it('pulls the id from a watch URL', () => {
    expect(extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('pulls the id from a youtu.be short URL', () => {
    expect(extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ');
  });
  it('accepts a bare 11-character id', () => {
    expect(extractYoutubeId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for junk', () => {
    expect(extractYoutubeId('https://example.com/not-a-video')).toBeNull();
    expect(extractYoutubeId('nope')).toBeNull();
  });
});

describe('parseTimedText', () => {
  const XML =
    '<transcript><text start="0">Hello &amp; world</text><text>second</text></transcript>';

  it('decodes entities and includes each cue', () => {
    const text = parseTimedText(XML);
    expect(text).toContain('Hello & world');
    expect(text).toContain('second');
  });

  it('returns an empty string when there are no cues', () => {
    expect(parseTimedText('<transcript></transcript>')).toBe('');
  });
});
