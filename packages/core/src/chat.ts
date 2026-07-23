import type { LlmProvider } from './llm/index.js';
import type { Citation, SearchHit, ChatResponse } from './types.js';

const SYSTEM = `You are CompanyBrain, a retrieval assistant answering questions strictly from a company's own knowledge base.

Rules:
- Answer only from the provided context. If the context does not contain the answer, say so plainly.
- Cite sources inline using bracketed numbers like [1], [2] that refer to the numbered context passages.
- Be concise and direct. No preamble, no filler.`;

export function buildContext(hits: SearchHit[]): string {
  return hits
    .map((h, i) => {
      const title = h.document.title ?? 'Untitled';
      return `[${i + 1}] ${title}\n${h.content}`;
    })
    .join('\n\n');
}

export function toCitations(hits: SearchHit[]): Citation[] {
  return hits.map((h, i) => ({
    index: i + 1,
    chunkId: h.chunkId,
    documentId: h.documentId,
    title: h.document.title,
    sourceUrl: h.document.sourceUrl,
    snippet: h.content.slice(0, 240),
  }));
}

/** Extractive fallback when no LLM is configured: stitch the top passages. */
export function extractiveAnswer(question: string, hits: SearchHit[]): ChatResponse {
  if (hits.length === 0) {
    return {
      message: `I could not find anything in the brain about "${question}".`,
      citations: [],
      usedHits: [],
    };
  }
  const top = hits.slice(0, 3);
  const body = top.map((h, i) => `[${i + 1}] ${h.content.slice(0, 400)}`).join('\n\n');
  return {
    message: `Here is the most relevant knowledge I found:\n\n${body}`,
    citations: toCitations(top),
    usedHits: top,
  };
}

export async function generateAnswer(
  llm: LlmProvider,
  question: string,
  hits: SearchHit[],
  history: { role: 'user' | 'assistant'; content: string }[] = [],
): Promise<ChatResponse> {
  if (!llm.available || hits.length === 0) {
    return extractiveAnswer(question, hits);
  }
  const context = buildContext(hits);
  const message = await llm.complete({
    system: SYSTEM,
    temperature: 0.2,
    maxTokens: 1024,
    messages: [
      ...history,
      {
        role: 'user',
        content: `Context passages:\n\n${context}\n\n---\nQuestion: ${question}`,
      },
    ],
  });
  return { message, citations: toCitations(hits), usedHits: hits };
}
