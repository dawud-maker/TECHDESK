const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL fehlt. Kopiere .env.example zu .env und trage deine PostgreSQL-Verbindung ein."
    );
}

const useSSL = process.env.DB_SSL === "true";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DB_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.on("error", error => {
    console.error("Unerwarteter PostgreSQL-Pool-Fehler:", error);
});

module.exports = pool;
