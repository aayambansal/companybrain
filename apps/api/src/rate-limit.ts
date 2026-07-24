/**
 * A tiny in-memory fixed-window rate limiter. Single-instance only (self-host
 * default); it resets on restart and does not coordinate across replicas, which
 * is fine for its job: slowing credential brute-force against one account.
 */
export interface RateLimitOptions {
  /** Max hits allowed within the window before requests are limited. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
/** Bound memory: distinct keys are swept of expired entries past this size. */
const MAX_KEYS = 20_000;

/**
 * Record a hit for `key` and report whether it is now over the limit. `now` is
 * injectable for tests. Pure aside from the shared in-memory store.
 */
export function hitRateLimit(
  key: string,
  opts: RateLimitOptions,
  now: number = Date.now(),
): { limited: boolean; retryAfterSeconds: number } {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    if (store.size >= MAX_KEYS) sweepExpired(now);
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { limited: false, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  if (entry.count > opts.max) {
    return { limited: true, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

/** Clear a key's counter, e.g. after a successful login. */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

function sweepExpired(now: number): void {
  for (const [k, v] of store) {
    if (now >= v.resetAt) store.delete(k);
  }
}
