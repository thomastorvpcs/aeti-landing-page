/**
 * Encryption Key Rotation Script
 *
 * PURPOSE
 * -------
 * Re-encrypts all sensitive DB fields (EIN, bank_account_number, bank_aba)
 * and re-computes EIN HMACs from the old key to a new key without any
 * downtime — the swap is done inside a single transaction.
 *
 * WHEN TO USE
 * -----------
 * - DB_ENCRYPTION_KEY is suspected to be compromised
 * - Routine key rotation policy (e.g. annual)
 *
 * HOW TO RUN
 * ----------
 * 1. Set the current key:  export OLD_KEY="<current DB_ENCRYPTION_KEY>"
 * 2. Generate a new key:   export NEW_KEY="$(openssl rand -base64 32)"
 * 3. Dry-run first:        node scripts/rotate-encryption-key.js --dry-run
 * 4. Run for real:         node scripts/rotate-encryption-key.js
 * 5. After success, update DB_ENCRYPTION_KEY in Azure App Service to NEW_KEY
 *    and restart both the API and worker services.
 *
 * NOTES
 * -----
 * - Requires direct DB access (run from a machine that can reach the DB, or
 *   temporarily whitelist your IP in Azure firewall).
 * - Set DATABASE_URL or the individual DB_* env vars before running.
 * - The script never logs decrypted values.
 * - Safe to re-run — if the process crashes mid-way, run again with the same
 *   OLD_KEY and NEW_KEY; already-rotated rows will fail pgp_sym_decrypt with
 *   OLD_KEY and be skipped (they are already on the new key).
 */

require("dotenv").config();
const { createHmac } = require("crypto");
const { Pool } = require("pg");

const OLD_KEY = process.env.OLD_KEY;
const NEW_KEY = process.env.NEW_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!OLD_KEY || !NEW_KEY) {
  console.error("ERROR: Set OLD_KEY and NEW_KEY environment variables before running.");
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error("ERROR: OLD_KEY and NEW_KEY are identical — nothing to rotate.");
  process.exit(1);
}

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

function newEinHmac(ein) {
  return createHmac("sha256", NEW_KEY)
    .update(ein.toLowerCase().trim())
    .digest("hex");
}

async function rotate() {
  const client = await pool.connect();
  try {
    console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes written)" : "LIVE"}`);

    // Fetch all rows, decrypting with the OLD key
    const { rows } = await client.query(`
      SELECT
        id,
        pgp_sym_decrypt(ein, $1)::text              AS ein,
        pgp_sym_decrypt(bank_account_number, $1)::text AS bank_account_number,
        pgp_sym_decrypt(bank_aba, $1)::text          AS bank_aba
      FROM resellers
    `, [OLD_KEY]);

    console.log(`Found ${rows.length} reseller(s) to rotate.`);
    if (rows.length === 0) {
      console.log("Nothing to do.");
      return;
    }

    if (DRY_RUN) {
      console.log("Dry run complete — no rows written. Remove --dry-run to apply.");
      return;
    }

    await client.query("BEGIN");

    for (const row of rows) {
      await client.query(`
        UPDATE resellers SET
          ein                = pgp_sym_encrypt($1, $4),
          ein_hmac           = $2,
          bank_account_number = pgp_sym_encrypt($3, $4),
          bank_aba           = pgp_sym_encrypt($5, $4),
          updated_at         = NOW()
        WHERE id = $6
      `, [
        row.ein,
        newEinHmac(row.ein),
        row.bank_account_number,
        NEW_KEY,
        row.bank_aba,
        row.id,
      ]);
      console.log(`  Rotated reseller ${row.id}`);
    }

    await client.query("COMMIT");
    console.log(`\nDone. ${rows.length} row(s) re-encrypted with new key.`);
    console.log("\nNEXT STEPS:");
    console.log("  1. Update DB_ENCRYPTION_KEY in Azure App Service → Configuration");
    console.log("     to the value of NEW_KEY.");
    console.log("  2. Restart the API (abti-api) and worker (abti-worker) services.");
    console.log("  3. Verify the dashboard loads reseller data correctly.");
    console.log("  4. Store the new key in your secrets manager and discard the old one.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("ERROR — transaction rolled back:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

rotate().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
