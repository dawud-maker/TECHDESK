const express = require("express");
const pool = require("../database/connection");

const router = express.Router();

/*
  Zeigt, welche echten OAuth-Anbieter konfiguriert sind.
  Für echtes Microsoft/Google/Apple OAuth werden Client-ID,
  Secret und Callback-URLs des jeweiligen Kontos benötigt.
*/
router.get("/providers", (req, res) => {
    res.json({
        success: true,
        providers: [
            {
                id: "microsoft",
                name: "Microsoft",
                enabled: Boolean(
                    process.env.MICROSOFT_CLIENT_ID &&
                    process.env.MICROSOFT_CLIENT_SECRET
                )
            },
            {
                id: "google",
                name: "Google",
                enabled: Boolean(
                    process.env.GOOGLE_CLIENT_ID &&
                    process.env.GOOGLE_CLIENT_SECRET
                )
            },
            {
                id: "apple",
                name: "Apple",
                enabled: Boolean(
                    process.env.APPLE_CLIENT_ID &&
                    process.env.APPLE_CLIENT_SECRET
                )
            }
        ]
    });
});

/*
  POST /api/auth/demo-login

  Für das aktuell vorhandene Frontend.
  Verwendet den ersten aktiven Admin/Agent aus der Datenbank.
  Kann über ALLOW_DEMO_LOGIN=false ausgeschaltet werden.
*/
router.post("/demo-login", async (req, res, next) => {
    try {
        if (process.env.ALLOW_DEMO_LOGIN === "false") {
            return res.status(403).json({
                success: false,
                message: "Demo-Anmeldung ist deaktiviert."
            });
        }

        const provider = String(req.body.provider || "").toLowerCase();

        if (!["microsoft", "google", "apple"].includes(provider)) {
            return res.status(400).json({
                success: false,
                message: "Ungültiger Login-Anbieter."
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                role,
                company_id
            FROM users
            WHERE role IN ('admin', 'agent')
              AND is_active = TRUE
            ORDER BY
                CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
                created_at ASC
            LIMIT 1
            `
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Kein aktiver ICT-Benutzer in der Datenbank gefunden."
            });
        }

        res.json({
            success: true,
            provider,
            demo: true,
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
