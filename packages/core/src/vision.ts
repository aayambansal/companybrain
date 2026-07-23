import type { ImageInput } from './llm/types.js';

/** Pure: parse a `data:<mediaType>;base64,<data>` URL into an ImageInput. */
export function parseDataUrl(input: string): ImageInput | null {
  const m = input.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!m) return null;
  return { mediaType: m[1] as string, base64: m[2] as string };
}
