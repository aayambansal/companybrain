import { MemoryEngine } from '@companybrain/core';
import { organizations, spaces } from '@companybrain/db';
import { eq } from 'drizzle-orm';
import { loadApiEnv, type ApiEnv } from './env.js';

/** The authenticated principal attached to a request. */
export interface AuthContext {
  orgId: string;
  userId?: string;
  apiKeyId?: string;
  scopes: string[];
  via: 'apiKey' | 'session';
}

/** Hono variables available on `c.var`. */
export interface Variables {
  auth: AuthContext;
}

/** Hono bindings/app-level singletons available on `c.env`-ish via a module. */
let engineSingleton: MemoryEngine | null = null;
let envSingleton: ApiEnv | null = null;

export function getEngine(): MemoryEngine {
  if (!engineSingleton) engineSingleton = new MemoryEngine();
  return engineSingleton;
}

export function getEnv(): ApiEnv {
  if (!envSingleton) envSingleton = loadApiEnv();
  return envSingleton;
}

/** Test/override hook. */
export function setEngine(engine: MemoryEngine): void {
  engineSingleton = engine;
}

let defaultOrgId: string | null = null;

/**
 * Provision (once) and return the default workspace used by single-user mode.
 * Idempotent: reuses the org with slug `default`, creating it plus a default
 * space on first call.
 */
export async function ensureDefaultOrg(): Promise<string> {
  if (defaultOrgId) return defaultOrgId;
  const engine = getEngine();
  const existing = await engine.db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, 'default'))
    .limit(1);
  if (existing[0]) {
    defaultOrgId = existing[0].id;
    await engine.getOrCreateDefaultSpace(defaultOrgId);
    return defaultOrgId;
  }
  const [org] = await engine.db
    .insert(organizations)
    .values({ name: 'My Workspace', slug: 'default' })
    .returning({ id: organizations.id });
  if (!org) throw new Error('failed to provision default workspace');
  defaultOrgId = org.id;
  await engine.db
    .insert(spaces)
    .values({ orgId: defaultOrgId, name: 'General', slug: 'general', isDefault: true, icon: 'brain' });
  return defaultOrgId;
}

/** Cached default org id if already provisioned this process. */
export function cachedDefaultOrgId(): string | null {
  return defaultOrgId;
}
