const rateLimit = require("express-rate-limit");

// Strip port from IP in case proxy forwards ip:port format
function keyGenerator(req) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return ip.replace(/:\d+$/, "");
}

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: "Too many requests. Please try again later." },
});

const submissionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: "Too many form submissions from this IP. Please try again later." },
});

const dashboardLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { error: "Too many login attempts. Please try again later." },
});

// Rate limiter for authenticated dashboard API routes — keyed per user (JWT sub)
// so limits are per-account, not per-IP (which could be shared via a proxy).
const dashboardApiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // generous for normal use; blocks runaway scripts
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.dashboardUser?.id || keyGenerator(req),
  message: { error: "Too many requests. Please slow down." },
});

// Tighter limit for state-changing actions that trigger external API calls
// (Acrobat Sign, SendGrid) — these are billable and should not be spammable.
const dashboardActionRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.dashboardUser?.id || keyGenerator(req),
  message: { error: "Too many actions. Please try again later." },
});

module.exports = {
  globalRateLimiter,
  submissionRateLimiter,
  dashboardLoginRateLimiter,
  dashboardApiRateLimiter,
  dashboardActionRateLimiter,
};
