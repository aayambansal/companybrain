import { describe, it, expect } from 'vitest';
import { composeVideoText, formatTimestamp } from './video.js';

describe('formatTimestamp', () => {
  it('formats seconds under an hour as m:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(9)).toBe('0:09');
    expect(formatTimestamp(75)).toBe('1:15');
  });

  it('formats hours as h:mm:ss', () => {
    expect(formatTimestamp(3661)).toBe('1:01:01');
  });

  it('clamps negatives to zero', () => {
    expect(formatTimestamp(-5)).toBe('0:00');
  });
});

describe('composeVideoText', () => {
  it('combines transcript and frame captions with timestamps', () => {
    const text = composeVideoText('hello there', [
      { atSec: 0, text: 'Title slide: Q3 Roadmap' },
      { atSec: 30, text: 'Chart showing revenue up' },
    ]);
    expect(text).toContain('Transcript:\nhello there');
    expect(text).toContain('On-screen frames:');
    expect(text).toContain('[0:00] Title slide: Q3 Roadmap');
    expect(text).toContain('[0:30] Chart showing revenue up');
  });

  it('omits sections that are empty', () => {
    expect(composeVideoText('just audio', [])).toBe('Transcript:\njust audio');
    expect(composeVideoText('', [{ atSec: 0, text: 'only a frame' }])).toBe(
      'On-screen frames:\n[0:00] only a frame',
    );
    expect(composeVideoText('', [])).toBe('');
  });
});
