const { verifyToken } = require("../services/dashboardAuth");

function requireDashboardAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.dashboardUser = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

module.exports = requireDashboardAuth;
