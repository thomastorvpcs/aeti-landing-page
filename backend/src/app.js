require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const { globalRateLimiter, submissionRateLimiter } = require("./middleware/rate-limit");
const submissionRouter = require("./routes/submission");
const docusignWebhookRouter = require("./routes/docusign-webhook");

const app = express();

// Security headers
app.use(helmet());

// CORS — allow Vite dev server and production origin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser requests (e.g., DocuSign webhook, health checks)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Body parsing (JSON for most routes)
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Global rate limiter
app.use(globalRateLimiter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/submit", submissionRateLimiter, submissionRouter);
app.use("/docusign/webhook", docusignWebhookRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

module.exports = app;
