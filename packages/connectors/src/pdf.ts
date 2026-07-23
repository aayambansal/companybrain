/**
 * PDF text extraction via unpdf (a pure-JS build of pdf.js, no native deps).
 */
import { extractText, getDocumentProxy } from 'unpdf';

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join('\n\n') : String(text)).trim();
}
