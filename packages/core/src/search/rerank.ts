import type { LlmProvider } from '../llm/index.js';
import type { SearchHit } from '../types.js';

/**
 * Pure: reorder hits by a list of indices. Unknown/duplicate indices are
 * ignored; any hit not named in `order` is appended in its original position.
 * Unit-testable without an LLM.
 */
export function applyRerankOrder(hits: SearchHit[], order: number[]): SearchHit[] {
  const seen = new Set<number>();
  const out: SearchHit[] = [];
  for (const i of order) {
    if (Number.isInteger(i) && i >= 0 && i < hits.length && !seen.has(i)) {
      seen.add(i);
      out.push(hits[i]!);
    }
  }
  hits.forEach((h, i) => {
    if (!seen.has(i)) out.push(h);
  });
  return out;
}

/** Pure: pull passage indices out of an LLM response like "2, 0, 1". */
export function parseOrder(text: string, max: number): number[] {
  return (text.match(/\d+/g) ?? []).map(Number).filter((n) => n >= 0 && n < max);
}

/**
 * Reorder hits with an LLM by relevance to the query. Falls back to the input
 * order if no LLM is available or the response is unusable.
 */
export async function llmRerank(llm: LlmProvider, query: string, hits: SearchHit[]): Promise<SearchHit[]> {
  if (!llm.available || hits.length <= 1) return hits;
  const list = hits
    .map((h, i) => `[${i}] ${h.document.title ? h.document.title + ' — ' : ''}${h.content.slice(0, 240)}`)
    .join('\n\n');
  const res = await llm.complete({
    system:
      'You reorder search results by relevance to a query. Return ONLY the passage numbers, most relevant first, comma-separated. No prose, no explanation.',
    messages: [{ role: 'user', content: `Query: ${query}\n\nPassages:\n${list}` }],
    temperature: 0,
    maxTokens: 120,
  });
  const order = parseOrder(res, hits.length);
  return order.length > 0 ? applyRerankOrder(hits, order) : hits;
}
