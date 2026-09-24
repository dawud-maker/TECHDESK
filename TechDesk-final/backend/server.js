require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const pool = require("./database/connection");

const ticketsRouter = require("./routes/tickets");
const usersRouter = require("./routes/users");
const statsRouter = require("./routes/stats");
const authRouter = require("./routes/auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.disable("x-powered-by");

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res, next) => {
    try {
        const db = await pool.query("SELECT NOW() AS database_time");

        res.json({
            success: true,
            service: "TechDesk API",
            status: "online",
            database: "connected",
            database_time: db.rows[0].database_time
        });
    } catch (error) {
        next(error);
    }
});

app.use("/api/tickets", ticketsRouter);
app.use("/api/users", usersRouter);
app.use("/api/stats", statsRouter);
app.use("/api/auth", authRouter);

/*
  Das Backend liefert auch frontend/index.html aus.
  Dadurch kann das Frontend immer /api verwenden und die
  API-Adresse muss beim Hosting nicht geändert werden.
*/
const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({
            success: false,
            message: "API-Endpunkt nicht gefunden."
        });
    }

    res.status(404).send("Seite nicht gefunden.");
});

app.use((err, req, res, next) => {
    console.error(err);

    const isDevelopment = process.env.NODE_ENV !== "production";

    res.status(500).json({
        success: false,
        message: "Interner Serverfehler.",
        ...(isDevelopment ? { error: err.message } : {})
    });
});

app.listen(PORT, HOST, () => {
    console.log(`TechDesk läuft auf Port ${PORT}`);
});
