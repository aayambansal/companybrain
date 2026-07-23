import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { organizations } from '@companybrain/db';
import { getEngine, type Variables } from '../context.js';

const app = new Hono<{ Variables: Variables }>();

interface StoredProvider {
  provider?: string;
  model?: string;
  apiKey?: string;
}
interface StoredProviders {
  embedding?: StoredProvider;
  llm?: StoredProvider;
}

const EMBEDDING_OPTIONS = [
  {
    provider: 'local',
    label: 'Local (zero-config, no key)',
    needsKey: false,
    models: ['cb-hash-embed-v1'],
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    needsKey: true,
    models: ['text-embedding-3-small', 'text-embedding-3-large'],
  },
  {
    provider: 'ollama',
    label: 'Ollama (local server)',
    needsKey: false,
    models: ['nomic-embed-text', 'mxbai-embed-large'],
  },
  { provider: 'google', label: 'Google', needsKey: true, models: ['text-embedding-004'] },
];
const LLM_OPTIONS = [
  { provider: 'none', label: 'None (extractive answers)', needsKey: false, models: ['none'] },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    needsKey: true,
    models: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  },
  { provider: 'openai', label: 'OpenAI', needsKey: true, models: ['gpt-4o-mini', 'gpt-4o'] },
  {
    provider: 'ollama',
    label: 'Ollama (local server)',
    needsKey: false,
    models: ['llama3.1', 'qwen2.5'],
  },
];

async function readStored(orgId: string): Promise<StoredProviders> {
  const engine = getEngine();
  const [org] = await engine.db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const providers = (org?.settings as Record<string, unknown> | undefined)?.providers;
  return (providers as StoredProviders) ?? {};
}

/** Map a stored provider entry into an engine config partial. */
function toEmbeddingConfig(p: StoredProvider) {
  const key = p.apiKey;
  return {
    provider: (p.provider as 'local' | 'openai' | 'ollama' | 'google') ?? 'local',
    model: p.model ?? 'text-embedding-3-small',
    ...(p.provider === 'openai' ? { openaiApiKey: key } : {}),
    ...(p.provider === 'google' ? { googleApiKey: key } : {}),
  };
}
function toLlmConfig(p: StoredProvider) {
  const key = p.apiKey;
  return {
    provider: (p.provider as 'anthropic' | 'openai' | 'ollama' | 'none') ?? 'none',
    model: p.model ?? 'claude-sonnet-5',
    ...(p.provider === 'anthropic' ? { anthropicApiKey: key } : {}),
    ...(p.provider === 'openai' ? { openaiApiKey: key } : {}),
  };
}

/** Apply stored providers to the running engine. */
export async function applyProviders(orgId: string): Promise<void> {
  const engine = getEngine();
  const stored = await readStored(orgId);
  const update: {
    embedding?: ReturnType<typeof toEmbeddingConfig>;
    llm?: ReturnType<typeof toLlmConfig>;
  } = {};
  if (stored.embedding?.provider) update.embedding = toEmbeddingConfig(stored.embedding);
  if (stored.llm?.provider) update.llm = toLlmConfig(stored.llm);
  if (update.embedding || update.llm) engine.configureProviders(update);
}

app.get('/', async (c) => {
  const auth = c.get('auth');
  const engine = getEngine();
  const stored = await readStored(auth.orgId);
  return c.json({
    // Never return raw keys; report whether one is set.
    embedding: {
      provider: engine.embedder.name,
      model: engine.embedder.model,
      hasKey: Boolean(stored.embedding?.apiKey),
    },
    llm: {
      provider: engine.llm.name,
      model: engine.llm.model,
      available: engine.llm.available,
      hasKey: Boolean(stored.llm?.apiKey),
    },
    options: { embedding: EMBEDDING_OPTIONS, llm: LLM_OPTIONS },
  });
});

const putSchema = z.object({
  embedding: z
    .object({ provider: z.string(), model: z.string().optional(), apiKey: z.string().optional() })
    .optional(),
  llm: z
    .object({ provider: z.string(), model: z.string().optional(), apiKey: z.string().optional() })
    .optional(),
});

app.put('/', async (c) => {
  const auth = c.get('auth');
  const body = await c.req.json().catch(() => ({}));
  const parsed = putSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: 'invalid_request', issues: parsed.error.issues }, 400);
  const engine = getEngine();

  const current = await readStored(auth.orgId);
  const next: StoredProviders = { ...current };
  if (parsed.data.embedding) {
    // Keep the existing key if the caller sent an empty string (means "unchanged").
    const key = parsed.data.embedding.apiKey || current.embedding?.apiKey;
    next.embedding = { ...parsed.data.embedding, apiKey: key };
  }
  if (parsed.data.llm) {
    const key = parsed.data.llm.apiKey || current.llm?.apiKey;
    next.llm = { ...parsed.data.llm, apiKey: key };
  }

  const [org] = await engine.db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, auth.orgId))
    .limit(1);
  const settings = { ...((org?.settings as Record<string, unknown>) ?? {}), providers: next };
  await engine.db
    .update(organizations)
    .set({ settings, updatedAt: new Date() })
    .where(eq(organizations.id, auth.orgId));

  await applyProviders(auth.orgId);
  return c.json({
    ok: true,
    embedding: { provider: engine.embedder.name, model: engine.embedder.model },
    llm: { provider: engine.llm.name, model: engine.llm.model, available: engine.llm.available },
    note: parsed.data.embedding
      ? 'Embedding provider changed. Re-index existing memories for comparable scores.'
      : undefined,
  });
});

// Probe a provider with a tiny request so the UI can validate keys.
app.post('/test', async (c) => {
  const auth = c.get('auth');
  await applyProviders(auth.orgId);
  const engine = getEngine();
  const result: { embedding?: string; llm?: string } = {};
  try {
    await engine.embedder.embedQuery('connection test');
    result.embedding = 'ok';
  } catch (e) {
    result.embedding = `error: ${String((e as Error).message ?? e).slice(0, 200)}`;
  }
  if (engine.llm.available) {
    try {
      await engine.llm.complete({
        messages: [{ role: 'user', content: 'Reply with the word ok.' }],
        maxTokens: 5,
      });
      result.llm = 'ok';
    } catch (e) {
      result.llm = `error: ${String((e as Error).message ?? e).slice(0, 200)}`;
    }
  } else {
    result.llm = 'not configured';
  }
  return c.json(result);
});

export default app;
