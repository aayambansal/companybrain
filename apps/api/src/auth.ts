import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify, sign } from 'hono/jwt';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { apiKeys } from '@companybrain/db';
import { getEngine, getEnv, type AuthContext, type Variables } from './context.js';
import { hashApiKey } from './crypto.js';

export const SESSION_COOKIE = 'cb_session';

export interface SessionClaims {
  sub: string; // userId
  org: string; // orgId
  exp?: number;
}

export async function signSession(userId: string, orgId: string, ttlSeconds = 60 * 60 * 24 * 7): Promise<string> {
  const env = getEnv();
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return sign({ sub: userId, org: orgId, exp }, env.jwtSecret);
}

function extractBearer(c: Context): string | null {
  const header = c.req.header('Authorization') ?? c.req.header('authorization');
  if (header && header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  const apiKeyHeader = c.req.header('x-api-key');
  if (apiKeyHeader) return apiKeyHeader.trim();
  return null;
}

/** Resolve an API key or session token into an AuthContext, or null. */
export async function resolveAuth(c: Context): Promise<AuthContext | null> {
  const token = extractBearer(c) ?? getCookie(c, SESSION_COOKIE) ?? null;
  if (!token) return null;

  // API key path
  if (token.startsWith('cb_')) {
    const engine = getEngine();
    const hash = hashApiKey(token);
    const now = new Date();
    const rows = await engine.db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, hash),
          isNull(apiKeys.revokedAt),
          or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, now)),
        ),
      )
      .limit(1);
    const key = rows[0];
    if (!key) return null;
    // Best-effort last-used stamp.
    void engine.db.update(apiKeys).set({ lastUsedAt: now }).where(eq(apiKeys.id, key.id));
    return {
      orgId: key.orgId,
      apiKeyId: key.id,
      scopes: key.scopes ?? ['*'],
      via: 'apiKey',
    };
  }

  // Session JWT path
  try {
    const env = getEnv();
    const payload = (await verify(token, env.jwtSecret, 'HS256')) as unknown as SessionClaims;
    if (!payload?.org || !payload?.sub) return null;
    return { orgId: payload.org, userId: payload.sub, scopes: ['*'], via: 'session' };
  } catch {
    return null;
  }
}

/** Middleware that requires a valid principal. */
export const requireAuth: MiddlewareHandler<{ Variables: Variables }> = async (c, next) => {
  const auth = await resolveAuth(c);
  if (!auth) {
    return c.json({ error: 'unauthorized', message: 'Missing or invalid credentials.' }, 401);
  }
  c.set('auth', auth);
  await next();
};
