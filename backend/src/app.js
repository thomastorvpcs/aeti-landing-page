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
