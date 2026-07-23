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
 * Pure: parse `index: score` lines (any order, extra prose tolerated) into a
 * scores array indexed by passage. Missing passages default to -1 so they sort
 * to the bottom. e.g. "0: 8\n1: 2\n2: 9" -> [8, 2, 9].
 */
export function parseScores(text: string, max: number): number[] {
  const scores = new Array<number>(max).fill(-1);
  const re = /(\d+)\s*[:=]\s*(-?\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const i = Number(m[1]);
    const s = Number(m[2]);
    if (Number.isInteger(i) && i >= 0 && i < max && Number.isFinite(s)) scores[i] = s;
  }
  return scores;
}

/**
 * Pointwise rerank: instead of asking the LLM to *order* the passages (hard for
 * a model), ask it to *score* each passage's relevance to the query on its own,
 * then sort by score with the original retrieval order breaking ties. This
 * usually sharpens rank-1 precision, which is what nDCG@10 rewards. Falls back
 * to the input order if no LLM is available or the response is unusable.
 */
export async function llmRerankPointwise(
  llm: LlmProvider,
  query: string,
  hits: SearchHit[],
  opts: { snippetChars?: number } = {},
): Promise<SearchHit[]> {
  if (!llm.available || hits.length <= 1) return hits;
  const snippetChars = opts.snippetChars ?? 600;
  const list = hits
    .map((h, i) => `[${i}] ${h.document.title ? h.document.title + ' — ' : ''}${h.content.slice(0, snippetChars)}`)
    .join('\n\n');
  const res = await llm.complete({
    system:
      'You rate how well each passage answers or directly supports a query. Score every passage from 0 (irrelevant) to 10 (directly and fully answers it) on its own merits, independent of the others. Output one line per passage as "index: score" and nothing else.',
    messages: [{ role: 'user', content: `Query: ${query}\n\nPassages:\n${list}` }],
    temperature: 0,
    maxTokens: 700,
  });
  const scores = parseScores(res, hits.length);
  if (scores.every((s) => s < 0)) return hits;
  // Stable sort by score desc; original index breaks ties (keeps retrieval order).
  return hits
    .map((h, i) => ({ h, i, s: scores[i] ?? -1 }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.h);
}

/**
 * Reorder hits with an LLM by relevance to the query. Falls back to the input
 * order if no LLM is available or the response is unusable.
 */
export async function llmRerank(
  llm: LlmProvider,
  query: string,
  hits: SearchHit[],
  opts: { snippetChars?: number } = {},
): Promise<SearchHit[]> {
  if (!llm.available || hits.length <= 1) return hits;
  const snippetChars = opts.snippetChars ?? 600;
  const list = hits
    .map((h, i) => `[${i}] ${h.document.title ? h.document.title + ' — ' : ''}${h.content.slice(0, snippetChars)}`)
    .join('\n\n');
  const res = await llm.complete({
    system:
      'You reorder search results by relevance to a query. Judge whether each passage actually answers or directly supports the query, not just topical overlap. Return ONLY the passage numbers, most relevant first, comma-separated. No prose, no explanation.',
    // Enough budget to emit an ordering over a large candidate set.
    messages: [{ role: 'user', content: `Query: ${query}\n\nPassages:\n${list}` }],
    temperature: 0,
    maxTokens: 600,
  });
  const order = parseOrder(res, hits.length);
  return order.length > 0 ? applyRerankOrder(hits, order) : hits;
}
