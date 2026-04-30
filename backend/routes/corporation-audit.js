/**
 * Sub-rotas de auditoria do painel corporativo.
 * Montado em /api/corporation/audit — herda verifyToken + verifyCorporation.
 */

import express from "express";
import { pool } from "../database/db.js";
import { ensureAuditTable } from "../utils/audit.js";

const router = express.Router();

router.use(async (req, res, next) => {
    try {
        await ensureAuditTable();
        next();
    } catch (e) {
        console.error("[CORP-AUDIT] Falha ao garantir tabela:", e);
        next();
    }
});

/**
 * GET /logs?actor=&action=&targetType=&from=&to=&limit=&offset=
 */
router.get("/logs", async (req, res) => {
    try {
        const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 100));
        const offset = Math.max(0, parseInt(req.query.offset) || 0);

        const where = [];
        const params = [];

        if (req.query.actor) {
            where.push("(a.actor_referenciaid = ? OR LOWER(a.actor_email) LIKE LOWER(?))");
            params.push(req.query.actor, `%${req.query.actor}%`);
        }
        if (req.query.action) {
            where.push("a.action = ?");
            params.push(req.query.action);
        }
        if (req.query.targetType) {
            where.push("a.target_type = ?");
            params.push(req.query.targetType);
        }
        if (req.query.from) {
            where.push("a.created_at >= ?");
            params.push(new Date(req.query.from).toISOString());
        }
        if (req.query.to) {
            where.push("a.created_at <= ?");
            params.push(new Date(req.query.to).toISOString());
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [rows] = await pool.query(
            `SELECT a.id, a.actor_referenciaid, a.actor_email, a.actor_perfil,
                    a.action, a.target_type, a.target_id, a.details, a.ip, a.user_agent, a.created_at,
                    u.Nome AS actor_nome
             FROM audit_logs a
             LEFT JOIN utilizadores u ON u.ReferenciaID = a.actor_referenciaid
             ${whereSql}
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS c FROM audit_logs a ${whereSql}`,
            params
        );

        res.json({
            status: "ok",
            logs: rows,
            total: parseInt(countRows[0]?.c || 0),
            limit,
            offset
        });
    } catch (err) {
        console.error("[CORP-AUDIT] /logs:", err);
        res.status(500).json({ status: "error", error: "Erro ao listar logs" });
    }
});

/**
 * GET /actions — lista distinta de acções para filtro
 */
router.get("/actions", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT action, COUNT(*) AS count
             FROM audit_logs
             GROUP BY action
             ORDER BY count DESC, action ASC`
        );
        res.json({ status: "ok", actions: rows });
    } catch (err) {
        console.error("[CORP-AUDIT] /actions:", err);
        res.status(500).json({ status: "error", error: "Erro ao listar acções" });
    }
});

/**
 * GET /actors — lista de actores com contagem
 */
router.get("/actors", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT a.actor_referenciaid, a.actor_email,
                    u.Nome AS actor_nome,
                    COUNT(*) AS count
             FROM audit_logs a
             LEFT JOIN utilizadores u ON u.ReferenciaID = a.actor_referenciaid
             GROUP BY a.actor_referenciaid, a.actor_email, u.Nome
             ORDER BY count DESC
             LIMIT 50`
        );
        res.json({ status: "ok", actors: rows });
    } catch (err) {
        console.error("[CORP-AUDIT] /actors:", err);
        res.status(500).json({ status: "error", error: "Erro ao listar actores" });
    }
});

export default router;
