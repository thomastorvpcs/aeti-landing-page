require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const { globalRateLimiter, submissionRateLimiter } = require("./middleware/rate-limit");
const submissionRouter = require("./routes/submission");
const docusignWebhookRouter = require("./routes/docusign-webhook");

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

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

// Debug — remove after confirming static serving works
app.get("/debug-paths", (_req, res) => {
  const fs = require("fs");
  const frontendDist = require("path").join(__dirname, "../public");
  res.json({
    __dirname,
    frontendDist,
    cwd: process.cwd(),
    publicExists: fs.existsSync(frontendDist),
    indexExists: fs.existsSync(require("path").join(frontendDist, "index.html")),
    files: fs.existsSync(frontendDist) ? fs.readdirSync(frontendDist) : [],
  });
});

// Routes
app.use("/api/submit", submissionRateLimiter, submissionRouter);
app.use("/docusign/webhook", docusignWebhookRouter);

// Serve React frontend (copied into backend/public during build)
const frontendDist = path.join(__dirname, "../public");
app.use(express.static(frontendDist));
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
