import { createHash } from 'node:crypto';

/** Stable content hash for change detection and dedupe. */
export function contentHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 64);
}
