import { describe, it, expect } from 'vitest';
import { parseDataUrl } from './vision.js';

describe('parseDataUrl', () => {
  it('parses a base64 image data URL', () => {
    const r = parseDataUrl('data:image/png;base64,iVBORw0KGgo=');
    expect(r).toEqual({ mediaType: 'image/png', base64: 'iVBORw0KGgo=' });
  });
  it('parses jpeg', () => {
    expect(parseDataUrl('data:image/jpeg;base64,AAAA')?.mediaType).toBe('image/jpeg');
  });
  it('returns null for non-data-urls', () => {
    expect(parseDataUrl('https://example.com/a.png')).toBeNull();
    expect(parseDataUrl('data:image/png,notbase64')).toBeNull();
    expect(parseDataUrl('')).toBeNull();
  });
});
