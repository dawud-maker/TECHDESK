const express = require("express");
const pool = require("../database/connection");

const router = express.Router();

/*
  GET /api/users
  Optional: ?role=customer|agent|admin
*/
router.get("/", async (req, res, next) => {
    try {
        const { role } = req.query;
        const validRoles = ["customer", "agent", "admin"];
        const values = [];

        let query = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.company_id,
                u.is_active,
                u.created_at,
                c.name AS company_name
            FROM users u
            LEFT JOIN companies c
                ON c.id = u.company_id
        `;

        if (role) {
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: "Ungültige Benutzerrolle."
                });
            }

            values.push(role);
            query += ` WHERE u.role = $1`;
        }

        query += ` ORDER BY u.last_name, u.first_name`;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/*
  GET /api/users/agents
  ICT-Team = admin + agent
*/
router.get("/agents", async (req, res, next) => {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                first_name,
                last_name,
                email,
                role,
                is_active
            FROM users
            WHERE role IN ('admin', 'agent')
              AND is_active = TRUE
            ORDER BY
                CASE WHEN role = 'admin' THEN 0 ELSE 1 END,
                last_name,
                first_name
            `
        );

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/*
  GET /api/users/:id
*/
router.get("/:id", async (req, res, next) => {
    try {
        const result = await pool.query(
            `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.company_id,
                u.is_active,
                u.created_at,
                c.name AS company_name
            FROM users u
            LEFT JOIN companies c
                ON c.id = u.company_id
            WHERE u.id = $1
            `,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Benutzer nicht gefunden."
            });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
