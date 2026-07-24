import { describe, it, expect } from 'vitest';
import { normalizeText, markdownToText, htmlToText } from './normalize.js';

describe('normalizeText', () => {
  it('normalizes newlines, non-breaking spaces, and trailing whitespace', () => {
    expect(normalizeText('a\r\nb c   \n')).toBe('a\nb c');
  });
  it('collapses big vertical gaps to a single blank line and trims', () => {
    expect(normalizeText('  a\n\n\n\nb  ')).toBe('a\n\nb');
  });
  it('collapses runs of spaces and tabs', () => {
    expect(normalizeText('a\t\t   b')).toBe('a b');
  });
  it('strips the null byte and other control chars (Postgres text rejects U+0000)', () => {
    const nul = String.fromCharCode(0);
    const bell = String.fromCharCode(7);
    const del = String.fromCharCode(127);
    expect(normalizeText('a' + nul + 'b')).toBe('ab');
    expect(normalizeText('x' + bell + del + 'y')).toBe('xy');
  });
  it('preserves tab, newline, and carriage return', () => {
    // \r becomes \n (existing behavior); tab and newline survive the strip.
    expect(normalizeText('p\tq\r\nr')).toBe('p\tq\nr');
  });
});

describe('markdownToText', () => {
  it('strips headings, emphasis, links, and images but keeps prose', () => {
    const md =
      '# Title\n\nSome **bold** and _italic_ and `code` and [a link](https://x) ![img](y.png).';
    const out = markdownToText(md);
    expect(out).toContain('Some bold and italic and code and a link');
    expect(out).not.toContain('#');
    expect(out).not.toContain('](');
    expect(out).not.toContain('!');
  });
  it('keeps the body of a fenced code block', () => {
    expect(markdownToText('```js\nconst x = 1;\n```')).toContain('const x = 1;');
  });
});

describe('htmlToText', () => {
  it('drops script/style and turns block tags into newlines', () => {
    const html = '<style>.a{}</style><p>Hello</p><script>bad()</script><div>World</div>';
    const out = htmlToText(html);
    expect(out).toContain('Hello');
    expect(out).toContain('World');
    expect(out).not.toContain('bad()');
    expect(out).not.toContain('.a{}');
  });
  it('decodes the common entities', () => {
    expect(htmlToText('<p>a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;</p>').trim()).toBe(
      'a & b <c> "d" \'e\'',
    );
  });
});
