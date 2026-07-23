import { MemoryEngine } from '@companybrain/core';
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
