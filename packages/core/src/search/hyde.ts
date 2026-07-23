import type { LlmProvider } from '../llm/types.js';

/**
 * HyDE (Hypothetical Document Embeddings). A short query is a poor probe into a
 * dense space; a passage that *answers* it sits much closer to the real answer
 * documents. So we ask the LLM to write a hypothetical answer, embed that, and
 * blend it with the raw query vector. Based on Gao et al., 2022.
 */

/** Pure: the prompt asking the LLM to draft a hypothetical answer passage. */
export function hydePrompt(query: string): string {
  return [
    'Write a short, factual passage (2-4 sentences) that directly answers the question or',
    'supports the claim below, as if excerpted from an authoritative document. Do not hedge,',
    'do not say you are unsure, and do not mention that it is hypothetical. Just write the passage.',
    '',
    `Question or claim: ${query}`,
  ].join('\n');
}

/** Generate a hypothetical answer passage for a query. Returns '' on any failure. */
export async function hypotheticalDocument(llm: LlmProvider, query: string): Promise<string> {
  if (!llm.available) return '';
  try {
    const out = await llm.complete({
      system: 'You write concise, confident, factual passages that answer a query, for retrieval.',
      messages: [{ role: 'user', content: hydePrompt(query) }],
      temperature: 0,
      maxTokens: 200,
    });
    return out.trim();
  } catch {
    return '';
  }
}

/**
 * Pure: element-wise average of equal-length vectors (ignores empty ones). The
 * mean of L2-normalized embeddings keeps cosine ranking well-behaved.
 */
export function blendVectors(vectors: number[][]): number[] {
  const nonEmpty = vectors.filter((v) => v.length > 0);
  if (nonEmpty.length === 0) return [];
  const dim = nonEmpty[0]!.length;
  const out = new Array<number>(dim).fill(0);
  let contributing = 0;
  for (const v of nonEmpty) {
    if (v.length !== dim) continue;
    contributing++;
    for (let i = 0; i < dim; i++) out[i]! += v[i]!;
  }
  for (let i = 0; i < dim; i++) out[i]! /= contributing;
  return out;
}
