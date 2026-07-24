/**
 * Matches C0 (U+0000–U+001F) and DEL (U+007F) control characters, except tab,
 * newline, and carriage return which carry real structure. Built from char
 * codes so no control characters live in this source file. Postgres text
 * storage rejects the null byte outright, so an unstripped one would fail the
 * insert and lose the whole document; the rest are noise.
 */
const CONTROL_CHARS = (() => {
  const chars: string[] = [];
  for (let c = 0; c <= 0x1f; c++) {
    if (c !== 0x09 && c !== 0x0a && c !== 0x0d) chars.push(String.fromCharCode(c));
  }
  chars.push(String.fromCharCode(0x7f));
  return new RegExp('[' + chars.join('') + ']', 'g');
})();

/**
 * Text normalization used before chunking. Keeps structure (paragraphs) but
 * collapses noise so chunk boundaries and embeddings are stable.
 */
export function normalizeText(input: string): string {
  return input
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/ /g, ' ') // non-breaking space
    .replace(/[ \t]+\n/g, '\n') // trailing whitespace per line
    .replace(/\n{3,}/g, '\n\n') // collapse big gaps to a single blank line
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** Naive Markdown-to-text: strip the noisiest markup, keep readable prose. */
export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[^\n]*\n?/g, '').replace(/```/g, '')) // keep code body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/^\s*>\s?/gm, '') // blockquotes
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italic
    .replace(/`([^`]+)`/g, '$1'); // inline code
}

/** Very small HTML-to-text: strip tags and decode a few entities. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
