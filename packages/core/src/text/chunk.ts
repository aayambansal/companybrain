import { estimateTokens } from './tokens.js';
import type { Chunk } from '../types.js';

export interface ChunkOptions {
  targetTokens: number;
  overlapTokens: number;
  maxTokens: number;
}

const DEFAULTS: ChunkOptions = { targetTokens: 512, overlapTokens: 64, maxTokens: 1024 };

/**
 * Split text into overlapping, semantically coherent chunks.
 *
 * Strategy: recursively split on the strongest available boundary
 * (paragraph -> sentence -> word) until each piece fits under `targetTokens`,
 * then greedily pack pieces into chunks with a token overlap between them.
 */
export function chunkText(input: string, opts: Partial<ChunkOptions> = {}): Chunk[] {
  const o = { ...DEFAULTS, ...opts };
  const text = input.trim();
  if (!text) return [];

  const pieces = splitToPieces(text, o.maxTokens);
  const chunks: Chunk[] = [];

  let current: string[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length === 0) return;
    const content = current.join(' ').trim();
    if (content) {
      chunks.push({
        index: chunks.length,
        content,
        tokenCount: estimateTokens(content),
      });
    }
  };

  for (const piece of pieces) {
    const t = estimateTokens(piece);
    if (currentTokens + t > o.targetTokens && current.length > 0) {
      flush();
      // Start next chunk with an overlap tail from the previous one.
      const overlap = takeOverlap(current, o.overlapTokens);
      current = overlap.slice();
      currentTokens = overlap.reduce((sum, p) => sum + estimateTokens(p), 0);
    }
    current.push(piece);
    currentTokens += t;
  }
  flush();

  // Re-index in case overlap logic produced empties.
  return chunks
    .filter((c) => c.content.length > 0)
    .map((c, i) => ({ ...c, index: i }));
}

/** Recursively break text into pieces that each fit under maxTokens. */
function splitToPieces(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  // Try successively finer separators.
  const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];
  for (const sep of separators) {
    if (!text.includes(sep)) continue;
    const parts = text.split(sep).filter((p) => p.trim().length > 0);
    if (parts.length < 2) continue;
    const out: string[] = [];
    for (const part of parts) {
      const withSep = sep === ' ' ? part : part + (sep.trim() ? sep.trimEnd() : '');
      if (estimateTokens(withSep) > maxTokens) {
        out.push(...splitToPieces(withSep, maxTokens));
      } else {
        out.push(withSep.trim());
      }
    }
    return out;
  }

  // No separators left; hard-split by characters.
  return hardSplit(text, maxTokens);
}

function hardSplit(text: string, maxTokens: number): string[] {
  const approxChars = Math.max(1, maxTokens * 4);
  const out: string[] = [];
  for (let i = 0; i < text.length; i += approxChars) {
    out.push(text.slice(i, i + approxChars));
  }
  return out;
}

/** Take a trailing slice of pieces summing to about `overlapTokens`. */
function takeOverlap(pieces: string[], overlapTokens: number): string[] {
  if (overlapTokens <= 0) return [];
  const out: string[] = [];
  let sum = 0;
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i]!;
    out.unshift(p);
    sum += estimateTokens(p);
    if (sum >= overlapTokens) break;
  }
  return out;
}
