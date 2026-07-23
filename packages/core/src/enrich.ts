/**
 * LLM enrichment: derive a summary, topical tags, and standalone facts from a
 * document at ingest time. All best-effort — failures and missing LLMs return
 * an empty enrichment so ingestion never blocks on it.
 */
import type { LlmProvider } from './llm/index.js';

export interface Enrichment {
  summary?: string;
  tags?: string[];
  facts?: string[];
}

const SYSTEM = `You extract structured metadata from a document for a company knowledge base.
Return ONLY minified JSON with exactly these keys:
- "summary": a 1-2 sentence gist.
- "tags": 3 to 6 short lowercase topical tags (single words or short phrases).
- "facts": up to 5 standalone factual statements a person could later recall.
No markdown, no prose, no code fences. JSON only.`;

/** Pure: parse the model's response into a clean Enrichment. Tolerant of noise. */
export function parseEnrichment(text: string): Enrichment {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return {};
  }
  const out: Enrichment = {};
  if (typeof obj.summary === 'string' && obj.summary.trim()) out.summary = obj.summary.trim().slice(0, 600);
  if (Array.isArray(obj.tags)) {
    const tags = obj.tags
      .map((t) => String(t).toLowerCase().trim())
      .filter((t) => t.length > 0 && t.length <= 40);
    if (tags.length) out.tags = Array.from(new Set(tags)).slice(0, 8);
  }
  if (Array.isArray(obj.facts)) {
    const facts = obj.facts.map((f) => String(f).trim()).filter((f) => f.length > 0).slice(0, 10);
    if (facts.length) out.facts = facts;
  }
  return out;
}

export async function enrichDocument(
  llm: LlmProvider,
  input: { title?: string | null; content: string },
): Promise<Enrichment> {
  if (!llm.available || !input.content.trim()) return {};
  try {
    const text = await llm.complete({
      system: SYSTEM,
      temperature: 0,
      maxTokens: 400,
      messages: [
        {
          role: 'user',
          content: `Title: ${input.title ?? '(none)'}\n\nDocument:\n${input.content.slice(0, 6000)}`,
        },
      ],
    });
    return parseEnrichment(text);
  } catch {
    return {};
  }
}
