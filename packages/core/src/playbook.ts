import type { LlmProvider } from './llm/index.js';
import type { Citation, SearchHit } from './types.js';
import { buildContext, toCitations } from './chat.js';

/**
 * Living playbooks. A team's answer to "why did we do it this way" is usually
 * "let me find the thread." This synthesizes a readable, structured document
 * from the memories on a topic, grounded in citations, so the thread becomes a
 * page. Regenerate it and it reflects what the team knows today.
 */

export interface PlaybookResult {
  title: string;
  /** The synthesized document, in Markdown. */
  content: string;
  citations: Citation[];
  usedHits: SearchHit[];
}

export const PLAYBOOK_SYSTEM = `You write internal playbooks for a team from its own knowledge base.

Produce a clear, well-structured Markdown document that a teammate could read on Monday and act on. Use these sections when the context supports them, and omit any you cannot ground in the context:

## Overview — 2-3 sentences on what this is and why it matters.
## Key facts & decisions — bullet points; cite each with [n] pointing at the numbered context passages.
## How it works — the process or steps, in order.
## People & context — who is involved and what they own.
## Open questions — what is unresolved or missing.

Rules:
- Use ONLY the provided context. Never invent facts. If a section has no support, leave it out.
- Cite specific claims inline with bracketed numbers like [1], [2].
- Be concrete and concise. No preamble, no filler, no "as an AI".`;

/** Pure: build the user prompt for a playbook over the given topic and context. */
export function buildPlaybookPrompt(topic: string, context: string): string {
  return `Topic: ${topic}\n\nContext passages:\n\n${context}\n\n---\nWrite the playbook for "${topic}" now, starting with a single "# " title line.`;
}

/** Pure: pull the first Markdown "# " heading as the title, else fall back. */
export function extractTitle(markdown: string, fallback: string): string {
  const m = /^\s*#\s+(.+)$/m.exec(markdown);
  return (m?.[1] ?? fallback).trim().slice(0, 200);
}

/**
 * Generate a playbook from the retrieved memories. Without an LLM (or with no
 * matching memories) it returns a plain outline of the sources so the feature
 * still produces something useful.
 */
export async function generatePlaybook(
  llm: LlmProvider,
  topic: string,
  hits: SearchHit[],
): Promise<PlaybookResult> {
  const citations = toCitations(hits);
  if (!llm.available || hits.length === 0) {
    const body = hits.length
      ? hits.map((h, i) => `- ${h.document.title ?? 'Untitled'} [${i + 1}]`).join('\n')
      : '_No memories found for this topic yet._';
    return {
      title: topic,
      content: `# ${topic}\n\n## Sources\n\n${body}`,
      citations,
      usedHits: hits,
    };
  }
  const content = await llm.complete({
    system: PLAYBOOK_SYSTEM,
    temperature: 0.3,
    maxTokens: 1600,
    messages: [{ role: 'user', content: buildPlaybookPrompt(topic, buildContext(hits)) }],
  });
  return { title: extractTitle(content, topic), content, citations, usedHits: hits };
}
