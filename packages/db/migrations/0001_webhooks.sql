-- Outbound webhooks: notify external systems when memories change.

CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text,
  events jsonb NOT NULL DEFAULT '["memory.created"]',
  active boolean NOT NULL DEFAULT true,
  last_status integer,
  last_delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhooks_org_idx ON webhooks (org_id);
