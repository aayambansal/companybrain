/**
 * Cheap, dependency-free token estimation. Not a real BPE tokenizer, but a
 * stable approximation good enough for chunk sizing. Roughly ~4 chars/token
 * for English, with a small correction for whitespace-heavy text.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  // Blend char- and word-based estimates.
  const byChars = chars / 4;
  const byWords = words * 1.3;
  return Math.max(1, Math.round((byChars + byWords) / 2));
}
