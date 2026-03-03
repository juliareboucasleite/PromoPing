/**
 * Rotas Corporação - Painel para gestão dos funcionários (PerfilId = 3)
 * Acesso apenas a utilizadores com PerfilId === 3.
 */

import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

function handleDatabaseError(err, res, defaultMessage) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        return res.status(503).json({
            status: "error",
            error: "Banco de dados não está acessível."
        });
    }
    return res.status(500).json({
        status: "error",
        error: defaultMessage || "Erro interno do servidor"
    });
}

async function verifyCorporation(req, res, next) {
    try {
        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({ status: "error", error: "Não autenticado" });
        }
        const [rows] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (rows.length === 0 || rows[0].PerfilId !== 3) {
            return res.status(403).json({
                status: "error",
                error: "Acesso negado. Apenas utilizadores corporativos."
            });
        }
        next();
    } catch (err) {
        console.error("[CORPORATION] Erro ao verificar perfil:", err);
        return handleDatabaseError(err, res, "Erro ao verificar permissões");
    }
}

router.use(verifyToken);
router.use(verifyCorporation);

/** Lista funcionários (suporte - PerfilId = 1) com detalhes */
router.get("/staff", async (req, res) => {
    try {
        const [staff] = await pool.query(
            `SELECT 
                u.ReferenciaID,
                u.Nome,
                u.Email,
                u.Telefone,
                u.DataRegisto,
                u.PerfilId,
                p.Nome AS PerfilNome
            FROM utilizadores u
            LEFT JOIN perfis p ON p.Id = u.PerfilId
            WHERE u.PerfilId = 1 AND u.Ativo = 1
            ORDER BY u.Nome`
        );
        res.json({ status: "ok", staff });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar staff:", err);
        return handleDatabaseError(err, res, "Erro ao buscar funcionários");
    }
});

/** Detalhe de um funcionário */
router.get("/staff/:referenciaID", async (req, res) => {
    try {
        const { referenciaID } = req.params;
        const [rows] = await pool.query(
            `SELECT 
                u.ReferenciaID,
                u.Nome,
                u.Email,
                u.Telefone,
                u.DataRegisto,
                u.PerfilId,
                p.Nome AS PerfilNome
            FROM utilizadores u
            LEFT JOIN perfis p ON p.Id = u.PerfilId
            WHERE u.ReferenciaID = ? AND u.PerfilId = 1`,
            [referenciaID]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: "error", error: "Funcionário não encontrado" });
        }
        res.json({ status: "ok", staff: rows[0] });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar funcionário:", err);
        return handleDatabaseError(err, res, "Erro ao buscar funcionário");
    }
});

/** Atividade / projetos do funcionário: eventos, bugs/projetos, conversas de suporte, notificações que fez */
router.get("/staff/:referenciaID/activity", async (req, res) => {
    try {
        const { referenciaID } = req.params;

        const [user] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ? AND PerfilId = 1",
            [referenciaID]
        );
        if (user.length === 0) {
            return res.status(404).json({ status: "error", error: "Funcionário não encontrado" });
        }

        const [calendarEvents] = await pool.query(
            `SELECT e.Id, e.Titulo, e.Descricao, e.Tipo, e.Status, e.StartDate, e.EndDate
             FROM admin_events e
             WHERE e.CreatedBy = ?
             ORDER BY e.StartDate DESC
             LIMIT 50`,
            [referenciaID]
        ).catch(() => [[]]);

        let bugsProjetos = [];
        try {
            const [cols] = await pool.query(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bugsprojetos' AND COLUMN_NAME = 'CreatedBy'"
            );
            if (cols.length > 0) {
                const [rows] = await pool.query(
                    `SELECT Id, Titulo, Tipo, Prioridade, Status, DataCriacao
                     FROM bugsprojetos WHERE CreatedBy = ?
                     ORDER BY DataCriacao DESC LIMIT 50`,
                    [referenciaID]
                );
                bugsProjetos = rows;
            }
        } catch (_) {}

        const [supportThreads] = await pool.query(
            `SELECT DISTINCT COALESCE(sm.threadId, sm.id) AS threadId
             FROM supportmessages sm
             WHERE sm.ReferenciaID = ? AND sm.senderType = 'support'
             ORDER BY threadId DESC
             LIMIT 50`,
            [referenciaID]
        ).catch(() => []);

        const [notifications] = await pool.query(
            `SELECT Id, Tipo, Titulo, Descricao, DataCriacao
             FROM corporation_notifications
             WHERE ReferenciaID = ?
             ORDER BY DataCriacao DESC
             LIMIT 30`,
            [referenciaID]
        ).catch(() => []);

        res.json({
            status: "ok",
            activity: {
                calendarEvents: calendarEvents,
                bugsProjetos: bugsProjetos,
                supportThreadsCount: supportThreads.length,
                notifications: notifications
            }
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar atividade:", err);
        return handleDatabaseError(err, res, "Erro ao buscar atividade");
    }
});

/** Eventos do calendário (read-only) - mesma fonte que o admin */
router.get("/calendar/events", async (req, res) => {
    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'admin_events'");
        if (tables.length === 0) {
            return res.json({ status: "ok", events: [] });
        }
        const { start, end } = req.query;
        let query = `
            SELECT 
                e.Id as id,
                e.Titulo as title,
                e.Descricao as description,
                e.Tipo as type,
                e.StartDate as start_date,
                e.EndDate as end_date,
                e.Status as status,
                e.CreatedBy as created_by,
                e.CreatedAt as created_at,
                u.Nome as created_by_name
            FROM admin_events e
            LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy
            WHERE 1=1
        `;
        const params = [];
        if (start && end) {
            query += ` AND (
                (e.StartDate >= ? AND e.StartDate <= ?) OR
                (e.EndDate >= ? AND e.EndDate <= ?) OR
                (e.StartDate <= ? AND e.EndDate >= ?)
            )`;
            params.push(start, end, start, end, start, end);
        }
        query += " ORDER BY e.StartDate ASC";
        const [events] = await pool.query(query, params);
        const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            type: event.type,
            start: event.start_date,
            end: event.end_date || null,
            status: event.status,
            createdBy: event.created_by,
            createdByName: event.created_by_name || 'Suporte',
            createdAt: event.created_at
        }));
        res.json({ status: "ok", events: formattedEvents });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar eventos:", err);
        return handleDatabaseError(err, res, "Erro ao buscar calendário");
    }
});

/** Avaliações (reviews) - com suporte que fechou quando tipo = suporte */
router.get("/reviews", async (req, res) => {
    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'reviews'");
        if (tables.length === 0) {
            return res.json({ status: "ok", reviews: [], total: 0, stats: [] });
        }
        const tipo = req.query.tipo;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;

        const columns = await pool.query("SHOW COLUMNS FROM reviews").then(([c]) => c.map(x => x.Field));
        const hasSupportRef = columns.includes('SupportReferenciaID');

        let query = `
            SELECT 
                r.Id,
                r.ReferenciaID,
                r.Tipo as tipo,
                r.Texto as texto,
                r.Rating as rating,
                CASE WHEN r.IsAnonimo = 1 THEN 1 ELSE 0 END as is_anonimo,
                r.CreatedAt as created_at,
                u.Nome as user_nome,
                u.Email as user_email
                ${hasSupportRef ? ", r.SupportReferenciaID, s.Nome as support_nome, s.Email as support_email" : ""}
            FROM reviews r
            LEFT JOIN utilizadores u ON r.ReferenciaID = u.ReferenciaID
            ${hasSupportRef ? "LEFT JOIN utilizadores s ON r.SupportReferenciaID = s.ReferenciaID" : ""}
            WHERE 1=1
        `;
        const params = [];
        if (tipo) {
            query += " AND r.Tipo = ?";
            params.push(tipo);
        }
        query += " ORDER BY r.CreatedAt DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [reviews] = await pool.query(query, params);

        let countQuery = "SELECT COUNT(*) as total FROM reviews WHERE 1=1";
        const countParams = tipo ? [tipo] : [];
        if (tipo) countQuery += " AND Tipo = ?";
        const [[{ total }]] = await pool.query(countQuery, countParams);

        const [statsResult] = await pool.query(`
            SELECT Tipo as tipo, COUNT(*) as total, AVG(Rating) as media_rating
            FROM reviews WHERE Rating IS NOT NULL GROUP BY Tipo
        `).catch(() => [[]]);

        res.json({
            status: "ok",
            reviews,
            total: total || 0,
            page,
            limit,
            totalPages: Math.ceil((total || 0) / limit),
            stats: statsResult
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar avaliações:", err);
        return handleDatabaseError(err, res, "Erro ao buscar avaliações");
    }
});

/** Dashboard: incidentes, atualizações sistema, bugs/projetos e eventos recentes */
router.get("/dashboard", async (req, res) => {
    try {
        const limit = 15;
        const out = { notifications: [], atualizacoesSistema: [], recentBugsProjetos: [], recentEvents: [] };

        const [hasNotif] = await pool.query("SHOW TABLES LIKE 'corporation_notifications'");
        if (hasNotif.length > 0) {
            const [notifications] = await pool.query(
                `SELECT n.Id, n.Tipo, n.Titulo, n.Descricao, n.ReferenciaID as author_id, n.DataCriacao,
                        u.Nome as author_nome
                 FROM corporation_notifications n
                 LEFT JOIN utilizadores u ON n.ReferenciaID = u.ReferenciaID
                 ORDER BY n.DataCriacao DESC LIMIT ?`,
                [limit]
            );
            out.notifications = notifications;
        }

        const [hasAtualizacoes] = await pool.query("SHOW TABLES LIKE 'atualizacoes_sistema'");
        if (hasAtualizacoes.length > 0) {
            const [rows] = await pool.query(
                `SELECT Id, Titulo, Descricao, Tipo, DataCriacao
                 FROM atualizacoes_sistema
                 ORDER BY DataCriacao DESC LIMIT ?`,
                [limit]
            );
            out.atualizacoesSistema = rows;
        }

        const [hasBugsTable] = await pool.query("SHOW TABLES LIKE 'bugsprojetos'");
        if (hasBugsTable.length > 0) {
            const [hasCol] = await pool.query(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bugsprojetos' AND COLUMN_NAME = 'CreatedBy'"
            );
            if (hasCol.length > 0) {
                const [bugs] = await pool.query(
                    `SELECT b.Id, b.Titulo, b.Tipo, b.Prioridade, b.Status, b.DataCriacao, b.CreatedBy as author_id, u.Nome as author_nome
                     FROM bugsprojetos b
                     LEFT JOIN utilizadores u ON u.ReferenciaID = b.CreatedBy
                     ORDER BY b.DataCriacao DESC LIMIT ?`,
                    [limit]
                );
                out.recentBugsProjetos = bugs;
            } else {
                const [bugs] = await pool.query(
                    `SELECT Id, Titulo, Tipo, Prioridade, Status, DataCriacao
                     FROM bugsprojetos
                     ORDER BY DataCriacao DESC LIMIT ?`,
                    [limit]
                );
                out.recentBugsProjetos = bugs.map(b => ({ ...b, author_id: null, author_nome: null }));
            }
        }

        const [hasEvents] = await pool.query("SHOW TABLES LIKE 'admin_events'");
        if (hasEvents.length > 0) {
            const [events] = await pool.query(
                `SELECT e.Id, e.Titulo, e.Tipo, e.Status, e.StartDate, e.CreatedBy as author_id, u.Nome as author_nome
                 FROM admin_events e
                 LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy
                 ORDER BY e.StartDate DESC LIMIT ?`,
                [limit]
            );
            out.recentEvents = events;
        }

        res.json({ status: "ok", ...out });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar dashboard:", err);
        return handleDatabaseError(err, res, "Erro ao carregar dashboard");
    }
});

/** Notificações do painel corporativo (atualizações/incidentes) */
router.get("/notifications", async (req, res) => {
    try {
        const [tables] = await pool.query("SHOW TABLES LIKE 'corporation_notifications'");
        if (tables.length === 0) {
            return res.json({ status: "ok", notifications: [] });
        }
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [notifications] = await pool.query(
            `SELECT n.Id, n.Tipo, n.Titulo, n.Descricao, n.ReferenciaID as author_id, n.DataCriacao,
                    u.Nome as author_nome, u.Email as author_email
             FROM corporation_notifications n
             LEFT JOIN utilizadores u ON n.ReferenciaID = u.ReferenciaID
             ORDER BY n.DataCriacao DESC LIMIT ?`,
            [limit]
        );
        res.json({ status: "ok", notifications });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar notificações:", err);
        return handleDatabaseError(err, res, "Erro ao buscar notificações");
    }
});

export default router;
