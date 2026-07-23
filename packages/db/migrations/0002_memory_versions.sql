-- Memory version history: snapshot a memory's prior content when it is updated,
-- so you can see how a fact changed over time (temporal change tracking).

CREATE TABLE IF NOT EXISTS memory_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  title text,
  content text,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_versions_doc_idx ON memory_versions (document_id);
