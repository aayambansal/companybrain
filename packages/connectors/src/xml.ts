/**
 * Tiny XML/HTML string helpers used by the web, sitemap, and RSS connectors.
 * Regex-based on purpose: no XML parser dependency.
 */

/** Unwrap `<![CDATA[ ... ]]>` sections, keeping their inner text. */
export function stripCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Decode CDATA plus the common XML/HTML entities, numeric and named. */
export function decodeXml(input: string): string {
  return stripCdata(input)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(Number(dec)))
    .replace(/&amp;/g, '&'); // decode ampersand last to avoid double-decoding
}

/** Read the text of the first `<tag>...</tag>` in `block`, decoded and trimmed. */
export function tagText(block: string, name: string): string | undefined {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i');
  const m = re.exec(block);
  const inner = m?.[1];
  return inner === undefined ? undefined : decodeXml(inner).trim();
}

/** Extract and decode the `<title>` of an HTML document. */
export function extractTitle(html: string): string | undefined {
  const m = /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i.exec(html);
  const inner = m?.[1];
  if (inner === undefined) return undefined;
  const title = decodeXml(inner).replace(/\s+/g, ' ').trim();
  return title || undefined;
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}
