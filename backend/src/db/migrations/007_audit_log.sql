CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT         NOT NULL,
  reseller_id   UUID         REFERENCES resellers(id) ON DELETE SET NULL,
  reseller_name TEXT,
  performed_by  TEXT         NOT NULL,
  details       TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
