-- Add NDA signer fields — separate from commercial contact when checkbox is unchecked
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS nda_signer_first_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nda_signer_last_name  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nda_signer_title      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS nda_signer_email      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS nda_signer_phone      VARCHAR(50);
