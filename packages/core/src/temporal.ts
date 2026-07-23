import type { LlmProvider } from './llm/types.js';

/**
 * Temporal reasoning. Knowledge changes: a launch date moves, an owner rotates,
 * a policy is revised. When a new memory arrives that states a newer version of
 * a fact already on record, the older one should be marked superseded so recall
 * returns the current truth (with the history still available). This module is
 * the LLM judge that decides which, if any, prior memories a new one replaces.
 */

/** A prior memory offered to the judge as a possible thing being superseded. */
export interface SupersedeCandidate {
  id: string;
  title: string | null;
  content: string;
  createdAt?: string;
}

/** The judge's verdict for one candidate. */
export interface SupersedeVerdict {
  id: string;
  supersedes: boolean;
  reason: string;
}

/** Pure: build the judge prompt comparing a new memory against candidates. */
export function buildSupersedePrompt(
  incoming: { title: string | null; content: string },
  candidates: SupersedeCandidate[],
): string {
  const cand = candidates
    .map((c, i) => {
      const when = c.createdAt ? ` (recorded ${c.createdAt})` : '';
      const head = c.title ? `${c.title}\n` : '';
      return `--- Candidate ${i + 1} [id=${c.id}]${when} ---\n${head}${clip(c.content, 700)}`;
    })
    .join('\n\n');

  return [
    'You compare a NEW memory against older memories to detect when the new one supersedes an old one.',
    'A memory supersedes another only when it states an UPDATED value for the SAME fact about the SAME subject:',
    'a changed date, status, owner, number, decision, or policy. Do NOT mark supersession for memories that are',
    'merely related, on the same topic, or that add new information without contradicting the old one.',
    '',
    'NEW memory:',
    (incoming.title ? incoming.title + '\n' : '') + clip(incoming.content, 900),
    '',
    'Older memories:',
    cand,
    '',
    'Return ONLY a JSON array, one object per candidate you judge, of the form:',
    '[{"id":"<candidate id>","supersedes":true|false,"reason":"<one short clause>"}]',
    'Include an entry only for candidates that are genuinely superseded (supersedes=true). If none are, return [].',
  ].join('\n');
}

/** Pure: parse the judge's reply into verdicts, tolerating prose around the JSON. */
export function parseSupersedeResponse(text: string, validIds: string[]): SupersedeVerdict[] {
  const valid = new Set(validIds);
  const json = extractJsonArray(text);
  if (!json) return [];
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: SupersedeVerdict[] = [];
  const seen = new Set<string>();
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : undefined;
    if (!id || !valid.has(id) || seen.has(id)) continue;
    if (row.supersedes !== true) continue;
    seen.add(id);
    out.push({
      id,
      supersedes: true,
      reason: typeof row.reason === 'string' ? row.reason.slice(0, 300) : '',
    });
  }
  return out;
}

/**
 * Ask the LLM which candidates the incoming memory supersedes. Returns [] when
 * no LLM is available or nothing is superseded. Never throws.
 */
export async function judgeSupersession(
  llm: LlmProvider,
  incoming: { title: string | null; content: string },
  candidates: SupersedeCandidate[],
): Promise<SupersedeVerdict[]> {
  if (!llm.available || candidates.length === 0) return [];
  try {
    const reply = await llm.complete({
      system: 'You are a precise fact-versioning judge. You output only JSON.',
      messages: [{ role: 'user', content: buildSupersedePrompt(incoming, candidates) }],
      temperature: 0,
      maxTokens: 400,
    });
    return parseSupersedeResponse(
      reply,
      candidates.map((c) => c.id),
    );
  } catch {
    return [];
  }
}

function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

/** Find the first balanced `[...]` array in a string (handles code fences/prose). */
function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
