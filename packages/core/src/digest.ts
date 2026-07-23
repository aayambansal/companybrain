import type { LlmProvider } from './llm/index.js';
import type { Memory } from './types.js';

/**
 * A digest of recent activity: what landed in the brain lately, synthesized into
 * a short brief. Where a playbook answers "what do we know about X", a digest
 * answers "what changed recently" — the standup you didn't have to attend.
 */

export interface DigestResult {
  /** A short Markdown brief, or a plain list without an LLM. */
  summary: string;
  /** The memories the digest was built from, newest first. */
  memories: { id: string; title: string | null; createdAt: string }[];
  count: number;
}

const SYSTEM = `You write a short digest of what recently landed in a team's knowledge base.

Given a list of recent items (titles and snippets), write 3-6 tight bullet points capturing what
is new: decisions, changes, and who or what is involved. Group related items. Be concrete, use the
items' own nouns, and do not invent anything not present. No preamble, no filler. Markdown bullets only.`;

/** Pure: build the prompt from recent items. */
export function buildDigestPrompt(items: { title: string | null; snippet: string }[]): string {
  const list = items
    .map((it, i) => `${i + 1}. ${it.title ?? 'Untitled'}${it.snippet ? ` — ${it.snippet}` : ''}`)
    .join('\n');
  return `Recent items:\n${list}\n\nWrite the digest now.`;
}

/**
 * Summarize recent memories into a digest. Without an LLM (or with nothing
 * recent) it returns a plain dated list so the feature still produces something.
 */
export async function generateDigest(llm: LlmProvider, memories: Memory[]): Promise<DigestResult> {
  const memoryRefs = memories.map((m) => ({ id: m.id, title: m.title, createdAt: m.createdAt }));
  if (memories.length === 0) {
    return { summary: '_Nothing new to report._', memories: [], count: 0 };
  }
  if (!llm.available) {
    const list = memories.map((m) => `- ${m.title ?? 'Untitled'}`).join('\n');
    return { summary: `## Recently added\n\n${list}`, memories: memoryRefs, count: memories.length };
  }
  const items = memories.map((m) => ({
    title: m.title,
    snippet: (m.summary ?? m.content ?? '').slice(0, 200).replace(/\s+/g, ' ').trim(),
  }));
  const summary = await llm.complete({
    system: SYSTEM,
    temperature: 0.3,
    maxTokens: 700,
    messages: [{ role: 'user', content: buildDigestPrompt(items) }],
  });
  return { summary: summary.trim(), memories: memoryRefs, count: memories.length };
}
