/**
 * Parse an integer query parameter, clamped to an optional [min, max] range.
 *
 * Missing or non-numeric input falls back to `fallback`. Clamping matters
 * because a raw `Number.parseInt('-5')` is a truthy negative that would slip
 * past a `|| default` guard and reach Postgres as a negative LIMIT/OFFSET,
 * which errors — so a bad value degrades to a valid one instead of a 500.
 */
export function queryInt(
  raw: string | undefined,
  opts: { fallback: number; min?: number; max?: number },
): number {
  const n = Number.parseInt(raw ?? '', 10);
  let v = Number.isFinite(n) ? n : opts.fallback;
  if (opts.min !== undefined) v = Math.max(opts.min, v);
  if (opts.max !== undefined) v = Math.min(opts.max, v);
  return v;
}
