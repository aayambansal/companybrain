-- Temporal reasoning: when a newer memory states an updated version of a fact
-- already on record, the older document is marked as superseded by the newer
-- one. Superseded documents are excluded from recall by default (the current
-- truth wins) while their history stays queryable.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES documents (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

-- Partial index: recall filters on `superseded_by IS NULL`, so only index the
-- rows that are actually superseded.
CREATE INDEX IF NOT EXISTS documents_superseded_idx
  ON documents (superseded_by)
  WHERE superseded_by IS NOT NULL;
