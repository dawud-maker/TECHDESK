const express = require("express");
const pool = require("../database/connection");

const router = express.Router();

const VALID_STATUSES = [
    "open",
    "in_progress",
    "on_hold",
    "completed"
];

const VALID_PRIORITIES = [
    "low",
    "medium",
    "high"
];

/*
  GET /api/tickets
  Optional:
    ?status=open
    ?priority=high
    ?search=laptop
*/
router.get("/", async (req, res, next) => {
    try {
        const { status, priority, search } = req.query;
        const values = [];
        const conditions = [];

        if (status) {
            if (!VALID_STATUSES.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: "Ungültiger Ticket-Status."
                });
            }

            values.push(status);
            conditions.push(`t.status = $${values.length}`);
        }

        if (priority) {
            if (!VALID_PRIORITIES.includes(priority)) {
                return res.status(400).json({
                    success: false,
                    message: "Ungültige Priorität."
                });
            }

            values.push(priority);
            conditions.push(`t.priority = $${values.length}`);
        }

        if (search) {
            values.push(`%${search}%`);
            const p = `$${values.length}`;

            conditions.push(`(
                CAST(t.ticket_number AS TEXT) ILIKE ${p}
                OR t.title ILIKE ${p}
                OR t.description ILIKE ${p}
                OR COALESCE(c.name, '') ILIKE ${p}
                OR COALESCE(cu.first_name, '') ILIKE ${p}
                OR COALESCE(cu.last_name, '') ILIKE ${p}
                OR COALESCE(cu.email, '') ILIKE ${p}
            )`);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const result = await pool.query(
            `
            SELECT
                t.id,
                t.ticket_number,
                t.company_id,
                t.customer_id,
                t.assigned_to,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.category,
                t.created_at,
                t.updated_at,
                t.completed_at,
                c.name AS company_name,
                CONCAT_WS(' ', cu.first_name, cu.last_name) AS customer_name,
                cu.email AS customer_email,
                CONCAT_WS(' ', au.first_name, au.last_name) AS assigned_agent_name
            FROM tickets t
            LEFT JOIN companies c
                ON c.id = t.company_id
            LEFT JOIN users cu
                ON cu.id = t.customer_id
            LEFT JOIN users au
                ON au.id = t.assigned_to
            ${where}
            ORDER BY t.created_at DESC
            `,
            values
        );

        res.json({
            success: true,
            tickets: result.rows
        });
    } catch (error) {
        next(error);
    }
});

/*
  GET /api/tickets/:id
*/
router.get("/:id", async (req, res, next) => {
    try {
        const result = await pool.query(
            `
            SELECT
                t.id,
                t.ticket_number,
                t.company_id,
                t.customer_id,
                t.assigned_to,
                t.title,
                t.description,
                t.status,
                t.priority,
                t.category,
                t.created_at,
                t.updated_at,
                t.completed_at,
                c.name AS company_name,
                CONCAT_WS(' ', cu.first_name, cu.last_name) AS customer_name,
                cu.email AS customer_email,
                CONCAT_WS(' ', au.first_name, au.last_name) AS assigned_agent_name
            FROM tickets t
            LEFT JOIN companies c
                ON c.id = t.company_id
            LEFT JOIN users cu
                ON cu.id = t.customer_id
            LEFT JOIN users au
                ON au.id = t.assigned_to
            WHERE t.id = $1
            `,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ticket nicht gefunden."
            });
        }

        res.json({
            success: true,
            ticket: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/*
  POST /api/tickets

  Body:
  {
    "name": "Max Muster",
    "email": "max@example.ch",
    "title": "Laptop startet nicht",
    "description": "Beschreibung...",
    "priority": "medium"
  }
*/
router.post("/", async (req, res, next) => {
    const client = await pool.connect();

    try {
        const {
            name,
            email,
            title,
            problem,
            description,
            priority = "medium",
            category = null,
            company_id = null
        } = req.body;

        const finalTitle = String(title || problem || "").trim();
        const finalName = String(name || "").trim();
        const finalEmail = String(email || "").trim().toLowerCase();
        const finalDescription = String(description || "").trim();

        if (!finalName || !finalEmail || !finalTitle || !finalDescription) {
            return res.status(400).json({
                success: false,
                message: "Name, E-Mail, Problem und Beschreibung sind erforderlich."
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
            return res.status(400).json({
                success: false,
                message: "Bitte eine gültige E-Mail-Adresse eingeben."
            });
        }

        if (!VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: "Ungültige Priorität."
            });
        }

        await client.query("BEGIN");

        const existingUser = await client.query(
            `
            SELECT id, company_id
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [finalEmail]
        );

        let customerId;
        let ticketCompanyId = company_id || null;

        if (existingUser.rows.length > 0) {
            customerId = existingUser.rows[0].id;

            if (!ticketCompanyId) {
                ticketCompanyId = existingUser.rows[0].company_id;
            }
        } else {
            const nameParts = finalName.split(/\s+/);
            const firstName = nameParts.shift() || finalName;
            const lastName = nameParts.join(" ");

            const newUser = await client.query(
                `
                INSERT INTO users (
                    company_id,
                    first_name,
                    last_name,
                    email,
                    role
                )
                VALUES ($1, $2, $3, $4, 'customer')
                RETURNING id
                `,
                [
                    ticketCompanyId,
                    firstName,
                    lastName,
                    finalEmail
                ]
            );

            customerId = newUser.rows[0].id;
        }

        const ticketResult = await client.query(
            `
            INSERT INTO tickets (
                company_id,
                customer_id,
                title,
                description,
                status,
                priority,
                category
            )
            VALUES ($1, $2, $3, $4, 'open', $5, $6)
            RETURNING
                id,
                ticket_number,
                company_id,
                customer_id,
                assigned_to,
                title,
                description,
                status,
                priority,
                category,
                created_at,
                updated_at,
                completed_at
            `,
            [
                ticketCompanyId,
                customerId,
                finalTitle,
                finalDescription,
                priority,
                category
            ]
        );

        await client.query("COMMIT");

        res.status(201).json({
            success: true,
            message: "Ticket wurde erstellt.",
            ticket: ticketResult.rows[0]
        });
    } catch (error) {
        await client.query("ROLLBACK");
        next(error);
    } finally {
        client.release();
    }
});

/*
  PATCH /api/tickets/:id

  Unterstützt:
    status
    priority
    assigned_to

  assigned_agent_id wird zusätzlich akzeptiert, damit ältere
  Frontend-Versionen nicht sofort brechen.
*/
router.patch("/:id", async (req, res, next) => {
    try {
        const {
            status,
            priority
        } = req.body;

        const assignedTo =
            req.body.assigned_to !== undefined
                ? req.body.assigned_to
                : req.body.assigned_agent_id;

        if (status !== undefined && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Ungültiger Status."
            });
        }

        if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: "Ungültige Priorität."
            });
        }

        const fields = [];
        const values = [];

        if (status !== undefined) {
            values.push(status);
            fields.push(`status = $${values.length}`);

            if (status === "completed") {
                fields.push("completed_at = COALESCE(completed_at, NOW())");
            } else {
                fields.push("completed_at = NULL");
            }
        }

        if (priority !== undefined) {
            values.push(priority);
            fields.push(`priority = $${values.length}`);
        }

        if (assignedTo !== undefined) {
            values.push(assignedTo || null);
            fields.push(`assigned_to = $${values.length}`);
        }

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Keine Änderungen angegeben."
            });
        }

        fields.push("updated_at = NOW()");
        values.push(req.params.id);

        const result = await pool.query(
            `
            UPDATE tickets
            SET ${fields.join(", ")}
            WHERE id = $${values.length}
            RETURNING
                id,
                ticket_number,
                company_id,
                customer_id,
                assigned_to,
                title,
                description,
                status,
                priority,
                category,
                created_at,
                updated_at,
                completed_at
            `,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ticket nicht gefunden."
            });
        }

        res.json({
            success: true,
            message: "Ticket wurde aktualisiert.",
            ticket: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

/*
  DELETE /api/tickets/:id
*/
router.delete("/:id", async (req, res, next) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM tickets
            WHERE id = $1
            RETURNING id
            `,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ticket nicht gefunden."
            });
        }

        res.json({
            success: true,
            message: "Ticket wurde gelöscht."
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
