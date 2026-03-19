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

// Temporary: list Acrobat Sign library templates to verify correct IDs
app.get("/debug-acrobat-templates", async (_req, res) => {
  try {
    const { getLibraryTemplates } = require("./services/acrobat-sign");
    const templates = await getLibraryTemplates();
    res.json(templates);
  } catch (err) {
    res.json({ error: err.message, detail: err.response?.data });
  }
});

// Temporary: register/re-register Acrobat Sign webhook with correct events
app.get("/debug-register-webhook", async (_req, res) => {
  try {
    const { registerWebhook } = require("./services/acrobat-sign");
    const webhookUrl = `${process.env.APP_BASE_URL}/acrobat/webhook`;
    const id = await registerWebhook(webhookUrl);
    res.json({ registered: true, webhookId: id, url: webhookUrl });
  } catch (err) {
    res.json({ error: err.message, detail: err.response?.data });
  }
});

// Temporary: clean up cancelled/broken reseller records
app.get("/admin/cleanup-cancelled", async (_req, res) => {
  try {
    const pool = require("./db");
    const result = await pool.query(`
      UPDATE resellers SET status = 'Cancelled'
      WHERE status = 'NDA Pending'
      AND (
        docusign_envelope_id IS NULL
        OR id IN (
          '9ba40eeb-240a-4c86-8963-b2cb68c6cd1b',
          '291b78c4-0a07-4e82-9f75-fa34413d0eca',
          '956722b3-4fd9-408e-8e06-7914e5c4e2ad',
          '5d0f786f-31a8-4461-bc51-7587f28d43b3',
          '8c9ef824-556c-4c7d-85b9-ffe9280c7ba9'
        )
      )
    `);
    res.json({ updated: result.rowCount });
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
