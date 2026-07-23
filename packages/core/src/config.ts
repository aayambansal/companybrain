/**
 * Environment-driven configuration for the CompanyBrain engine.
 * Every provider is pluggable and chosen here.
 */

export type EmbeddingProviderName = 'local' | 'openai' | 'ollama' | 'google';
export type LlmProviderName = 'anthropic' | 'openai' | 'ollama' | 'none';

export interface EngineConfig {
  databaseUrl: string;
  embedding: {
    provider: EmbeddingProviderName;
    model: string;
    dimensions: number;
    openaiApiKey?: string;
    googleApiKey?: string;
    ollamaBaseUrl: string;
  };
  llm: {
    provider: LlmProviderName;
    model: string;
    anthropicApiKey?: string;
    openaiApiKey?: string;
    ollamaBaseUrl: string;
  };
  chunk: {
    targetTokens: number;
    overlapTokens: number;
    maxTokens: number;
  };
  enrich: {
    /** Run LLM enrichment (summary + auto-tags + facts) on ingest when an LLM is set. */
    enabled: boolean;
  };
  temporal: {
    /** On ingest, ask the LLM whether the new memory supersedes similar older ones. */
    enabled: boolean;
    /** How many similar prior memories to weigh as supersession candidates. */
    candidates: number;
  };
  hyde: {
    /** Hypothetical passages to generate and average when hyde search is requested. */
    samples: number;
  };
}

function env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

function intEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Storage dimension for the vector column. Must match the DB migration. */
export const STORAGE_DIMENSIONS = 1536;

export function loadConfig(overrides: Partial<EngineConfig> = {}): EngineConfig {
  const base: EngineConfig = {
    databaseUrl: env('DATABASE_URL', 'postgres://companybrain:companybrain@localhost:5432/companybrain'),
    embedding: {
      provider: (env('EMBEDDING_PROVIDER', 'local') as EmbeddingProviderName) || 'local',
      model: env('EMBEDDING_MODEL', 'text-embedding-3-small'),
      dimensions: STORAGE_DIMENSIONS,
      openaiApiKey: env('OPENAI_API_KEY') || undefined,
      googleApiKey: env('GOOGLE_API_KEY') || undefined,
      ollamaBaseUrl: env('OLLAMA_BASE_URL', 'http://localhost:11434'),
    },
    llm: {
      provider: (env('LLM_PROVIDER', 'anthropic') as LlmProviderName) || 'anthropic',
      model: env('LLM_MODEL', 'claude-sonnet-5'),
      anthropicApiKey: env('ANTHROPIC_API_KEY') || undefined,
      openaiApiKey: env('OPENAI_API_KEY') || undefined,
      ollamaBaseUrl: env('OLLAMA_BASE_URL', 'http://localhost:11434'),
    },
    chunk: {
      targetTokens: intEnv('CHUNK_TARGET_TOKENS', 512),
      overlapTokens: intEnv('CHUNK_OVERLAP_TOKENS', 64),
      maxTokens: intEnv('CHUNK_MAX_TOKENS', 1024),
    },
    enrich: {
      enabled: env('ENRICH_ON_INGEST', 'true') !== 'false',
    },
    temporal: {
      enabled: env('TEMPORAL_RESOLUTION', 'false') === 'true',
      candidates: intEnv('TEMPORAL_CANDIDATES', 5),
    },
    hyde: {
      samples: intEnv('HYDE_SAMPLES', 1),
    },
  };
  return { ...base, ...overrides };
}
