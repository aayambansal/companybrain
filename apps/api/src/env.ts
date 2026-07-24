export type AuthMode = 'single' | 'multi';

export interface ApiEnv {
  host: string;
  port: number;
  jwtSecret: string;
  corsOrigins: string[];
  version: string;
  /**
   * `single` (default): no sign-in. Every request maps to one default workspace,
   *   which is the frictionless self-host experience. Optionally gate it with
   *   ACCESS_TOKEN so an exposed instance is not wide open.
   * `multi`: full auth, register/login/JWT/API keys, many workspaces.
   */
  authMode: AuthMode;
  /** Optional shared bearer token that guards single-user mode when set. */
  accessToken?: string;
  /**
   * Per-principal cap on LLM generations per minute, shared across the
   * endpoints that call the model every request (chat, playbook synthesis).
   * These drive real provider cost, so a leaked key or a runaway agent loop is
   * bounded here. Default 60/min is far above interactive use; set to 0 to
   * disable for high-volume automation.
   */
  llmRateLimitPerMin: number;
}

export function loadApiEnv(): ApiEnv {
  const corsRaw = process.env.CORS_ORIGINS ?? 'http://localhost:3000';
  const authMode: AuthMode = process.env.AUTH_MODE === 'multi' ? 'multi' : 'single';
  return {
    host: process.env.API_HOST ?? '0.0.0.0',
    // API_PORT wins (explicit config); otherwise honor the conventional PORT
    // that platforms like Railway, Heroku, and Cloud Run inject.
    port: Number.parseInt(process.env.API_PORT ?? process.env.PORT ?? '3333', 10),
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
    corsOrigins: corsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    version: process.env.COMPANYBRAIN_VERSION ?? '0.1.0',
    authMode,
    accessToken: process.env.ACCESS_TOKEN || undefined,
    llmRateLimitPerMin: parseLimit(process.env.LLM_RATE_LIMIT_PER_MIN, 60),
  };
}

/** Parse a non-negative integer limit, falling back on blank/invalid input. */
function parseLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
