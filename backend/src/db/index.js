const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "aeti_onboarding",
        user: process.env.DB_USER || "aeti",
        password: process.env.DB_PASSWORD || "aeti_dev",
      },
  { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }
);

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL client error", err);
});

module.exports = pool;
