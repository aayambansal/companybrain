-- CompanyBrain initial schema.
-- Postgres 14+ with the `vector` (pgvector) extension.

CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('pending', 'processing', 'indexed', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM ('active', 'paused', 'error', 'disconnected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('running', 'success', 'error', 'partial');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── organizations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug varchar(128) NOT NULL,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_idx ON organizations (slug);

-- ── users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email varchar(320) NOT NULL,
  name text,
  password_hash text,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'member',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_org_idx ON users (org_id);

-- ── api_keys ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  name text NOT NULL,
  key_hash text NOT NULL,
  prefix varchar(16) NOT NULL,
  scopes jsonb NOT NULL DEFAULT '["*"]',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_org_idx ON api_keys (org_id);

-- ── spaces ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  slug varchar(128) NOT NULL,
  description text,
  icon varchar(64),
  color varchar(16),
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS spaces_org_slug_idx ON spaces (org_id, slug);
CREATE INDEX IF NOT EXISTS spaces_org_idx ON spaces (org_id);

-- ── connections ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  space_id uuid REFERENCES spaces (id) ON DELETE SET NULL,
  connector varchar(64) NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  credentials jsonb NOT NULL DEFAULT '{}',
  status connection_status NOT NULL DEFAULT 'active',
  cursor text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS connections_org_idx ON connections (org_id);
CREATE INDEX IF NOT EXISTS connections_connector_idx ON connections (connector);

-- ── documents ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections (id) ON DELETE SET NULL,
  connector varchar(64) NOT NULL DEFAULT 'api',
  source_type varchar(64),
  source_id text,
  source_url text,
  title text,
  content text,
  summary text,
  content_hash varchar(64),
  tags jsonb NOT NULL DEFAULT '[]',
  metadata jsonb NOT NULL DEFAULT '{}',
  status document_status NOT NULL DEFAULT 'pending',
  error text,
  token_count integer,
  source_created_at timestamptz,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_org_idx ON documents (org_id);
CREATE INDEX IF NOT EXISTS documents_space_idx ON documents (space_id);
CREATE INDEX IF NOT EXISTS documents_status_idx ON documents (status);
CREATE INDEX IF NOT EXISTS documents_connector_idx ON documents (connector);
-- Dedupe/upsert key per connection + source id (nulls allowed for API docs).
CREATE UNIQUE INDEX IF NOT EXISTS documents_source_idx
  ON documents (connection_id, source_id)
  WHERE connection_id IS NOT NULL AND source_id IS NOT NULL;

-- ── chunks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES spaces (id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  token_count integer,
  embedding vector(1536),
  -- Generated full-text search vector over the chunk content.
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id);
CREATE INDEX IF NOT EXISTS chunks_space_idx ON chunks (space_id);
CREATE INDEX IF NOT EXISTS chunks_org_idx ON chunks (org_id);
CREATE UNIQUE INDEX IF NOT EXISTS chunks_doc_chunk_idx ON chunks (document_id, chunk_index);
-- Full-text GIN index.
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);
-- Approximate-nearest-neighbour vector index (cosine).
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- ── sync_runs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections (id) ON DELETE CASCADE,
  status sync_status NOT NULL DEFAULT 'running',
  stats jsonb NOT NULL DEFAULT '{}',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS sync_runs_connection_idx ON sync_runs (connection_id);

-- ── chat_sessions / chat_messages ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  space_id uuid REFERENCES spaces (id) ON DELETE SET NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_sessions_org_idx ON chat_sessions (org_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions (id) ON DELETE CASCADE,
  role varchar(16) NOT NULL,
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id);
