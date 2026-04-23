const express = require("express");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const { hashPassword, verifyPassword, signToken } = require("../services/dashboardAuth");
const requireDashboardAuth = require("../middleware/requireDashboardAuth");

// 5 attempts per hour per IP — create-user is a rare admin operation
const createUserLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account creation attempts. Try again later." },
});

const router = express.Router();

// POST /api/dashboard/auth/login
router.post("/login", async (req, res, next) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const { rows } = await pool.query(
      "SELECT id, email, name, password_hash FROM dashboard_users WHERE lower(email) = $1 AND is_active = true",
      [email]
    );

    // Use constant-time comparison path even when user not found to prevent timing attacks
    const user = rows[0];
    const hashToCheck = user ? user.password_hash : "$2b$12$invalidhashfortimingprotection000000000000000000000000";
    const match = await verifyPassword(password, hashToCheck);

    if (!user || !match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(user.id, user.email, user.name);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    next(err);
  }
});

// POST /api/dashboard/auth/create-user  (admin-only)
router.post("/create-user", createUserLimiter, async (req, res, next) => {
  try {
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret || req.headers["x-admin-secret"] !== adminSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const email = (req.body.email || "").trim().toLowerCase();
    const name = (req.body.name || "").trim();
    const password = req.body.password || "";

    if (!email || !name || !password) {
      return res.status(422).json({ error: "email, name, and password are required." });
    }
    if (password.length < 12) {
      return res.status(422).json({ error: "Password must be at least 12 characters." });
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      "INSERT INTO dashboard_users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name",
      [email, passwordHash, name]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(422).json({ error: "A user with that email already exists." });
    }
    next(err);
  }
});

// POST /api/dashboard/auth/change-password  (requires JWT)
router.post("/change-password", requireDashboardAuth, async (req, res, next) => {
  try {
    const newPassword = req.body.newPassword || "";
    if (newPassword.length < 12) {
      return res.status(422).json({ error: "Password must be at least 12 characters." });
    }

    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      "UPDATE dashboard_users SET password_hash = $1 WHERE id = $2",
      [passwordHash, req.dashboardUser.id]
    );

    console.log(`[dashboard] Password changed for user=${req.dashboardUser.email}`);
    res.json({ changed: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
