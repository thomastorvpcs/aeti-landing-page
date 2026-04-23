-- Encrypt sensitive fields at rest using pgcrypto symmetric encryption.
-- Affected columns: ein, bank_account_number, bank_aba
--
-- EIN also gets an ein_hmac column (deterministic HMAC) so that the unique
-- index and ON CONFLICT dedup continue to work despite pgp_sym_encrypt being
-- non-deterministic (random session key per call).
--
-- The encryption key is read from the 'app.encryption_key' GUC, which
-- migrate.js sets via set_config() before running this file.

-- Step 1: Rename existing plaintext columns to a temporary name
ALTER TABLE resellers RENAME COLUMN ein TO ein_plaintext;
ALTER TABLE resellers RENAME COLUMN bank_account_number TO bank_account_number_plaintext;
ALTER TABLE resellers RENAME COLUMN bank_aba TO bank_aba_plaintext;

-- Step 2: Add the new encrypted BYTEA columns and the HMAC dedup column
ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS ein              BYTEA,
  ADD COLUMN IF NOT EXISTS ein_hmac         TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number BYTEA,
  ADD COLUMN IF NOT EXISTS bank_aba         BYTEA;

-- Step 3: Encrypt existing rows (no-op when the table is empty)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM resellers WHERE ein_plaintext IS NOT NULL LIMIT 1) THEN
    UPDATE resellers
    SET
      ein      = pgp_sym_encrypt(ein_plaintext, current_setting('app.encryption_key')),
      ein_hmac = encode(
                   hmac(lower(trim(ein_plaintext)), current_setting('app.encryption_key'), 'sha256'),
                   'hex'
                 ),
      bank_account_number = CASE
        WHEN bank_account_number_plaintext IS NOT NULL
        THEN pgp_sym_encrypt(bank_account_number_plaintext, current_setting('app.encryption_key'))
        ELSE NULL
      END,
      bank_aba = CASE
        WHEN bank_aba_plaintext IS NOT NULL
        THEN pgp_sym_encrypt(bank_aba_plaintext, current_setting('app.encryption_key'))
        ELSE NULL
      END;
  END IF;
END $$;

-- Step 4: Enforce NOT NULL on the columns that were NOT NULL before
ALTER TABLE resellers
  ALTER COLUMN ein      SET NOT NULL,
  ALTER COLUMN ein_hmac SET NOT NULL;

-- Step 5: Replace the old unique index on ein_plaintext with one on ein_hmac
DROP INDEX IF EXISTS idx_resellers_ein;
CREATE UNIQUE INDEX IF NOT EXISTS idx_resellers_ein_hmac ON resellers (ein_hmac);

-- Step 6: Drop the plaintext columns — no longer needed
ALTER TABLE resellers
  DROP COLUMN ein_plaintext,
  DROP COLUMN bank_account_number_plaintext,
  DROP COLUMN bank_aba_plaintext;
