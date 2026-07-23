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
  };
}
