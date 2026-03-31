const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

function signToken(id, email, name) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET env var is not set");
  return jwt.sign({ sub: id, email, name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET env var is not set");
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
