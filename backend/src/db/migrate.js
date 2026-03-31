require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./index");

const MIGRATIONS = [
  "001_initial.sql",
  "002_add_vendor_fields.sql",
  "003_add_nda_signer.sql",
];

async function migrate() {
  for (const file of MIGRATIONS) {
    const sql = fs.readFileSync(path.join(__dirname, "migrations", file), "utf8");
    try {
      await pool.query(sql);
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      console.error(`Migration failed: ${file} —`, err.message);
      process.exit(1);
    }
  }
  await pool.end();
}

migrate();
