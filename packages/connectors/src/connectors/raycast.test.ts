import { describe, it, expect } from 'vitest';
import { raycastNote } from './raycast.js';

describe('raycastNote', () => {
  it('uses a leading markdown heading as the title and strips it from the body', () => {
    const { title, body } = raycastNote('# Standup notes\n\nShipped the API.', 'file');
    expect(title).toBe('Standup notes');
    expect(body).toBe('Shipped the API.');
  });

  it('uses the first line as title but keeps the full body when there is no heading', () => {
    const { title, body } = raycastNote('Quick idea\nmore detail here', 'file');
    expect(title).toBe('Quick idea');
    expect(body).toContain('Quick idea');
    expect(body).toContain('more detail here');
  });

  it('falls back to the filename for an empty note', () => {
    expect(raycastNote('   \n  ', 'my-note')).toEqual({ title: 'my-note', body: '' });
  });

  it('truncates a very long first line used as a title', () => {
    const long = 'word '.repeat(40);
    expect(raycastNote(long, 'f').title.length).toBeLessThanOrEqual(80);
  });
});
