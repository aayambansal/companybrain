import type { MiddlewareHandler } from 'hono';
import type { AuthContext, Variables } from './context.js';
import { getEnv } from './context.js';
import { hitRateLimit } from './rate-limit.js';

/**
 * Identify the caller for rate-limiting: the API key if one was presented, else
 * the signed-in user, else the org (single-user mode). Each principal gets its
 * own budget so one busy caller cannot exhaust everyone else's.
 */
export function principalKey(auth: AuthContext): string {
  return auth.apiKeyId ?? auth.userId ?? auth.orgId;
}

/**
 * Cap LLM generations per principal per minute across the endpoints that call
 * the model on every request (chat, playbook synthesis). They share one budget
 * because the thing being bounded is provider spend, which an unbounded caller
 * (a leaked key, a runaway agent loop) drives regardless of which route it
 * hits. The limit is read per-request so LLM_RATE_LIMIT_PER_MIN=0 disables it
 * without a restart in tests; in practice env is resolved once and cached.
 */
export const llmRateLimit: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const max = getEnv().llmRateLimitPerMin;
  if (max <= 0) return next();

  const key = `llm:${principalKey(c.var.auth)}`;
  const { limited, retryAfterSeconds } = hitRateLimit(key, { max, windowMs: 60_000 });
  if (limited) {
    c.header('Retry-After', String(retryAfterSeconds));
    return c.json(
      {
        error: 'rate_limited',
        message: `LLM rate limit reached (${max}/min). Retry in ${retryAfterSeconds}s.`,
      },
      429,
    );
  }
  return next();
};
