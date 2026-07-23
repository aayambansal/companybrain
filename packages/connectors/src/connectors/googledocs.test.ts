import { describe, it, expect } from 'vitest';
import { extractGoogleDocId } from './googledocs.js';

describe('extractGoogleDocId', () => {
  it('pulls the id from an edit URL', () => {
    expect(extractGoogleDocId('https://docs.google.com/document/d/1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWx/edit#heading=x')).toBe(
      '1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWx',
    );
  });
  it('accepts a bare id', () => {
    expect(extractGoogleDocId('1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWx')).toBe('1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUvWx');
  });
  it('returns null for junk', () => {
    expect(extractGoogleDocId('https://example.com/not-a-doc')).toBeNull();
    expect(extractGoogleDocId('short')).toBeNull();
  });
});
