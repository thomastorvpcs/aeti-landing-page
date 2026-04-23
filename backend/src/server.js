require("dotenv").config();
const app = require("./app");
const pool = require("./db");

// ─── Required environment variables ───────────────────────────────────────────
const REQUIRED_ENV = [
  "DB_ENCRYPTION_KEY",
  "JWT_SECRET",
  "DASHBOARD_SECRET",
  "ALLOWED_ORIGINS",
  "AZURE_STORAGE_CONNECTION_STRING",
  "AZURE_SERVICE_BUS_CONNECTION_STRING",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "ACROBAT_CLIENT_ID",
];

function checkEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error("[startup] Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
  console.log("[startup] Environment variables OK");
}

// ─── Database connectivity check ──────────────────────────────────────────────
async function checkDb() {
  try {
    await pool.query("SELECT 1");
    console.log("[startup] Database connection OK");
  } catch (err) {
    console.error("[startup] Database connection failed:", err.message);
    process.exit(1);
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  checkEnv();
  await checkDb();
  const server = app.listen(PORT, () => {
    console.log(`[startup] AETI backend running on port ${PORT}`);
  });

  process.on("SIGTERM", () => {
    console.log("[shutdown] SIGTERM received — closing server");
    server.close(() => {
      pool.end()
        .then(() => { console.log("[shutdown] Graceful shutdown complete"); process.exit(0); })
        .catch(() => process.exit(1));
    });
    // Force exit after 10s if connections don't drain
    setTimeout(() => { console.warn("[shutdown] Forced exit after timeout"); process.exit(1); }, 10000).unref();
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
