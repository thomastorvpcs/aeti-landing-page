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
  "007_audit_log.sql",
];

async function migrate() {
  const client = await pool.connect();
  try {
    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Fetch already-applied migrations
    const { rows } = await client.query("SELECT filename FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    // Bootstrap: if the tracking table is empty but the DB already has the
    // encrypted resellers schema (ein column is BYTEA), migrations 001–006
    // were applied before tracking existed — mark them as done.
    if (applied.size === 0) {
      const { rows: cols } = await client.query(`
        SELECT data_type FROM information_schema.columns
        WHERE table_name = 'resellers' AND column_name = 'ein'
      `);
      if (cols.length > 0 && cols[0].data_type === 'bytea') {
        const legacy = MIGRATIONS.slice(0, 6); // 001–006
        for (const file of legacy) {
          await client.query("INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING", [file]);
          applied.add(file);
        }
        console.log("[migrate] Bootstrapped tracking for 6 previously applied migrations.");
      }
    }

    const encKey = process.env.DB_ENCRYPTION_KEY;
    if (!encKey) {
      console.warn(
        "[migrate] WARNING: DB_ENCRYPTION_KEY is not set. " +
        "Migration 006 will fail if the resellers table already has rows."
      );
    } else {
      await client.query("SELECT set_config('app.encryption_key', $1, false)", [encKey]);
    }

    let skipped = 0;
    for (const file of MIGRATIONS) {
      if (applied.has(file)) {
        console.log(`Skipping (already applied): ${file}`);
        skipped++;
        continue;
      }

      const sql = fs.readFileSync(path.join(__dirname, "migrations", file), "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`Migration applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`Migration failed: ${file} —`, err.message);
        process.exit(1);
      }
    }

    console.log(`\nDone. ${MIGRATIONS.length - skipped} applied, ${skipped} skipped.`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
