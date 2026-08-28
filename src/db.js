require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL environment variable. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const useSSL = process.env.PGSSL !== "false";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

pool.on("error", (err) => {
  console.error("Unexpected database error", err);
});

module.exports = pool;
