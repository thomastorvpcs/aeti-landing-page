-- AETI Reseller Onboarding — initial schema
-- Run with: psql $DATABASE_URL -f 001_initial.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS resellers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company
  legal_company_name    VARCHAR(255) NOT NULL,
  dba                   VARCHAR(255),
  ein                   TEXT NOT NULL,         -- stored encrypted via pgcrypto at app layer
  entity_type           VARCHAR(50)  NOT NULL,
  address_street        VARCHAR(255) NOT NULL,
  address_city          VARCHAR(100) NOT NULL,
  address_state         VARCHAR(10)  NOT NULL,
  address_zip           VARCHAR(20)  NOT NULL,

  -- Primary contact
  contact_first_name    VARCHAR(100) NOT NULL,
  contact_last_name     VARCHAR(100) NOT NULL,
  contact_title         VARCHAR(100),
  contact_email         VARCHAR(255) NOT NULL,
  contact_phone         VARCHAR(50)  NOT NULL,

  -- Accounts payable contact (optional)
  ap_name               VARCHAR(255),
  ap_email              VARCHAR(255),
  ap_phone              VARCHAR(50),

  -- Document references (S3 object keys)
  w9_s3_key             VARCHAR(512),
  bank_letter_s3_key    VARCHAR(512),
  signed_nda_s3_key     VARCHAR(512),

  -- Integration IDs
  docusign_envelope_id  VARCHAR(255),
  netsuite_vendor_id    VARCHAR(255),

  -- Workflow state
  status                VARCHAR(64) NOT NULL DEFAULT 'Initiated',

  -- Timestamps
  signed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for idempotent lookups via EIN
CREATE UNIQUE INDEX IF NOT EXISTS idx_resellers_ein ON resellers (ein);

-- Index for status-based queries (pipeline dashboard)
CREATE INDEX IF NOT EXISTS idx_resellers_status ON resellers (status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resellers_updated_at ON resellers;
CREATE TRIGGER trg_resellers_updated_at
  BEFORE UPDATE ON resellers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
