require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./index");

const MIGRATIONS = [
  "001_initial.sql",
  "002_add_vendor_fields.sql",
  "003_add_nda_signer.sql",
  "004_add_reseller_signed_at.sql",
  "005_dashboard_users.sql",
  "006_encrypt_sensitive_fields.sql",
];

async function migrate() {
  // Use a single client so that the session GUC set below is visible to all
  // migration queries, including the pgcrypto encryption step in 006.
  const client = await pool.connect();
  try {
    const encKey = process.env.DB_ENCRYPTION_KEY;
    if (!encKey) {
      console.warn(
        "[migrate] WARNING: DB_ENCRYPTION_KEY is not set. " +
        "Migration 006 will fail if the resellers table already has rows."
      );
    } else {
      // set_config(name, value, is_local=false) → session-level GUC.
      // Using a parameterised call prevents the key from appearing in query logs.
      await client.query("SELECT set_config('app.encryption_key', $1, false)", [encKey]);
    }

    for (const file of MIGRATIONS) {
      const sql = fs.readFileSync(path.join(__dirname, "migrations", file), "utf8");
      try {
        await client.query(sql);
        console.log(`Migration applied: ${file}`);
      } catch (err) {
        console.error(`Migration failed: ${file} —`, err.message);
        process.exit(1);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
