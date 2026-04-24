require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { globalRateLimiter, submissionRateLimiter, dashboardLoginRateLimiter, dashboardApiRateLimiter } = require("./middleware/rate-limit");
const submissionRouter = require("./routes/submission");
const acrobatWebhookRouter = require("./routes/acrobat-webhook");
const dashboardAuthRouter = require("./routes/dashboardAuth");
const dashboardRouter = require("./routes/dashboard");

const app = express();
app.set("trust proxy", 1);

// Frontend is served by Azure Static Web Apps — no static file serving here

// Security headers (CSP disabled — Vite assets are self-hosted)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — only needed for API routes, not static assets
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
if (allowedOrigins.length === 0) {
  console.warn("[app] WARNING: ALLOWED_ORIGINS is not set — all CORS requests will be denied");
}
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, webhooks, health checks)
      if (!origin) return cb(null, true);
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
app.use("/api/dashboard/auth", dashboardLoginRateLimiter, dashboardAuthRouter);
app.use("/api/dashboard", dashboardApiRateLimiter, dashboardRouter);

// 404 for any unmatched routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler — log full detail server-side, return generic message in production
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production"
    ? (status < 500 ? err.message : "Internal server error")
    : err.message;
  res.status(status).json({ error: message || "Internal server error" });
});

module.exports = app;
