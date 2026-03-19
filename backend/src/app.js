require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const { globalRateLimiter, submissionRateLimiter } = require("./middleware/rate-limit");
const submissionRouter = require("./routes/submission");
const acrobatWebhookRouter = require("./routes/acrobat-webhook");

const app = express();
app.set("trust proxy", 1);

// Serve static assets FIRST — before any middleware that could interfere
const frontendDist = path.join(__dirname, "../public");
app.use(express.static(frontendDist));

// Security headers (CSP disabled — Vite assets are self-hosted)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — only needed for API routes, not static assets
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, webhooks, health checks)
      if (!origin) return cb(null, true);
      // If no allowlist configured, allow all
      if (allowedOrigins.length === 0) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Global rate limiter
app.use(globalRateLimiter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// API routes
app.use("/api/submit", submissionRateLimiter, submissionRouter);
app.use("/acrobat/webhook", acrobatWebhookRouter);

// Temporary admin route to run DB migration
app.get("/admin/run-migration", async (_req, res) => {
  try {
    const pool = require("./db");
    const fs = require("fs");
    const path = require("path");
    const sql = fs.readFileSync(path.join(__dirname, "db/migrations/002_add_vendor_fields.sql"), "utf8");
    await pool.query(sql);
    res.json({ success: true });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// SPA fallback — all unmatched routes serve index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

module.exports = app;
