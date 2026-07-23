import { describe, it, expect } from 'vitest';
import { stripCdata, decodeXml, tagText, extractTitle } from './xml.js';

describe('stripCdata', () => {
  it('unwraps CDATA sections, keeping inner text', () => {
    expect(stripCdata('<![CDATA[hello & <b>world</b>]]>')).toBe('hello & <b>world</b>');
  });
  it('leaves non-CDATA text untouched', () => {
    expect(stripCdata('plain text')).toBe('plain text');
  });
});

describe('decodeXml', () => {
  it('decodes the common named entities', () => {
    expect(decodeXml('a &lt;b&gt; &quot;c&quot; &apos;d&apos;')).toBe('a <b> "c" \'d\'');
  });
  it('decodes numeric and hex character references', () => {
    expect(decodeXml('&#233; &#x2014;')).toBe('é —');
  });
  it('decodes the ampersand last so entities are not double-decoded', () => {
    // "&amp;lt;" should become "&lt;", not "<".
    expect(decodeXml('&amp;lt;')).toBe('&lt;');
  });
  it('drops out-of-range code points safely', () => {
    expect(decodeXml('&#x110000;')).toBe('');
  });
});

describe('tagText', () => {
  it('reads the first matching tag, decoded and trimmed', () => {
    expect(tagText('<title>  Ship &amp; go  </title>', 'title')).toBe('Ship & go');
  });
  it('matches tags that carry attributes', () => {
    expect(tagText('<link href="x">value</link>', 'link')).toBe('value');
  });
  it('returns undefined when the tag is absent', () => {
    expect(tagText('<a>x</a>', 'title')).toBeUndefined();
  });
});

describe('extractTitle', () => {
  it('extracts and collapses whitespace in the document title', () => {
    expect(extractTitle('<html><head><title>Hello\n   World</title></head></html>')).toBe('Hello World');
  });
  it('returns undefined for a missing or empty title', () => {
    expect(extractTitle('<html></html>')).toBeUndefined();
    expect(extractTitle('<title>   </title>')).toBeUndefined();
  });
});
