const express = require("express");
const pool = require("../database/connection");

const router = express.Router();

/*
  GET /api/stats
*/
router.get("/", async (req, res, next) => {
    try {
        const [
            statusResult,
            priorityResult,
            totalsResult
        ] = await Promise.all([
            pool.query(
                `
                SELECT
                    status,
                    COUNT(*)::int AS count
                FROM tickets
                GROUP BY status
                ORDER BY status
                `
            ),
            pool.query(
                `
                SELECT
                    priority,
                    COUNT(*)::int AS count
                FROM tickets
                GROUP BY priority
                ORDER BY priority
                `
            ),
            pool.query(
                `
                SELECT
                    COUNT(*)::int AS total,
                    COUNT(*) FILTER (
                        WHERE created_at >= NOW() - INTERVAL '7 days'
                    )::int AS week,
                    COUNT(*) FILTER (
                        WHERE created_at >= NOW() - INTERVAL '1 month'
                    )::int AS month,
                    COUNT(*) FILTER (
                        WHERE created_at >= NOW() - INTERVAL '1 year'
                    )::int AS year,
                    COUNT(*) FILTER (
                        WHERE status = 'completed'
                          AND completed_at IS NOT NULL
                          AND completed_at::date = CURRENT_DATE
                    )::int AS today_completed
                FROM tickets
                `
            )
        ]);

        const totals = totalsResult.rows[0];

        res.json({
            success: true,
            total: totals.total,
            week: totals.week,
            month: totals.month,
            year: totals.year,
            today_completed: totals.today_completed,
            by_status: statusResult.rows,
            by_priority: priorityResult.rows
        });
    } catch (error) {
        next(error);
    }
});

/*
  GET /api/stats/chart?period=week|month|year
*/
router.get("/chart", async (req, res, next) => {
    try {
        const period = req.query.period || "week";

        if (!["week", "month", "year"].includes(period)) {
            return res.status(400).json({
                success: false,
                message: "Ungültiger Zeitraum."
            });
        }

        let query;

        if (period === "year") {
            query = `
                SELECT
                    TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS period,
                    COUNT(*)::int AS count
                FROM tickets
                WHERE created_at >= NOW() - INTERVAL '1 year'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY DATE_TRUNC('month', created_at)
            `;
        } else if (period === "month") {
            query = `
                SELECT
                    TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS period,
                    COUNT(*)::int AS count
                FROM tickets
                WHERE created_at >= NOW() - INTERVAL '1 month'
                GROUP BY DATE_TRUNC('day', created_at)
                ORDER BY DATE_TRUNC('day', created_at)
            `;
        } else {
            query = `
                SELECT
                    TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS period,
                    COUNT(*)::int AS count
                FROM tickets
                WHERE created_at >= NOW() - INTERVAL '7 days'
                GROUP BY DATE_TRUNC('day', created_at)
                ORDER BY DATE_TRUNC('day', created_at)
            `;
        }

        const result = await pool.query(query);

        res.json({
            success: true,
            period,
            data: result.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
