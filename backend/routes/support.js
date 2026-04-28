/**
 * PromoPing Support API Routes
 *
 * Endpoints:
 * - POST /api/support/ticket - Criar ticket (AI-first, fallback legado)
 * - POST /api/support/chat - Primeiro atendimento automático (motor de intenções, sem IA externa)
 * - GET  /api/support/messages/admin - Listar todas as threads (admin)
 * - GET  /api/support/messages - Listar threads do utilizador autenticado
 * - GET  /api/support/messages/:id - Obter thread específica com respostas
 * - POST /api/support/messages - Criar nova thread (nova conversa)
 * - POST /api/support/messages/:id/reply - Responder à thread existente
 */

import express from "express";
import { body, validationResult } from "express-validator";
import { pool } from "../database/db.js";
import { verifyToken, optionalToken } from "../middleware/auth.js";
import { createTicket as createTicketController, VALID_CONTEXTS } from "../controllers/support.controller.js";
import { processMessage } from "../services/supportChatEngine.js";
import { createTicketChannel, sendMessageToChannel } from "../services/supportDiscordNotifier.js";

const router = express.Router();

const ticketValidation = [
    body("message")
        .isString()
        .trim()
        .isLength({ min: 10 })
        .withMessage("Mensagem é obrigatória e deve ter pelo menos 10 caracteres"),
    body("context")
        .isString()
        .trim()
        .notEmpty()
        .isIn(VALID_CONTEXTS)
        .withMessage("Contexto é obrigatório e deve ser um de: " + VALID_CONTEXTS.join(", ")),
    body("channel").optional().isString().trim(),
];

router.post(
    "/ticket",
    verifyToken,
    ticketValidation,
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ error: errors.array().map((e) => e.msg).join("; ") });
        }
        return createTicketController(req, res);
    }
);

/**
 * POST /api/support/chat
 *
 * Recebe uma mensagem do utilizador, analisa a intenção (JS puro) e devolve
 * uma resposta amigável. Para intenção UNKNOWN, devolve escalateToHuman: true.
 *
 * Body: { "userId": number, "message": string }
 * Response: { "reply": string, "intent": string, "escalateToHuman": boolean }
 */
router.post("/chat", async (req, res) => {
    try {
        const { userId, message } = req.body || {};

        if (message === undefined || message === null) {
            return res.status(400).json({
                error: "O campo 'message' é obrigatório",
            });
        }
        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "A mensagem não pode estar vazia",
            });
        }

        const id = typeof userId === "number" ? userId : parseInt(userId, 10) || 0;
        const result = processMessage(message.trim(), id);

        return res.json({
            reply: result.reply,
            intent: result.intent,
            escalateToHuman: result.escalateToHuman,
        });
    } catch (err) {
        console.error(" [SUPPORT] Erro em /chat:", err);
        return res.status(500).json({
            error: "Erro ao processar a mensagem",
        });
    }
});

/** ReferenciaID usado para utilizadores anónimos (não logados) no suporte */
const ANON_REFERENCIA_ID = "ANON";

async function tableExists(tableName) {
    const [rows] = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?",
        [String(tableName || "").toLowerCase()]
    );
    return rows.length > 0;
}

async function columnExists(tableName, columnName) {
    const [rows] = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = ?
           AND column_name = ?
         LIMIT 1`,
        [String(tableName || "").toLowerCase(), String(columnName || "").toLowerCase()]
    );
    return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
    if (!(await columnExists(tableName, columnName))) {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function createIndexIfMissing(indexName, tableName, expression) {
    await pool.query(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${expression})`);
}

/**
 * Garante que existe o utilizador "Anónimo" na BD (para mensagens de suporte sem login)
 */
async function ensureAnonUser() {
    try {
        const [rows] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ?",
            [ANON_REFERENCIA_ID]
        );
        if (rows.length > 0) return;
        const bcrypt = await import("bcrypt");
        const senhaHash = await bcrypt.hash("anonymous", 10);
        await pool.query(
            `INSERT INTO utilizadores (ReferenciaID, Nome, Email, SenhaHash, Ativo, PerfilId)
             VALUES (?, 'Anónimo', 'anon@promoping.local', ?, 1, 2)`,
            [ANON_REFERENCIA_ID, senhaHash]
        );
        console.log(" [SUPPORT] Utilizador anónimo (ANON) criado na BD");
    } catch (e) {
        // Pode falhar se email já existir noutro user; ignorar
        if (e.code !== "ER_DUP_ENTRY" && e.code !== "ER_DUP_KEY") {
            console.warn(" [SUPPORT] Aviso ao criar utilizador anónimo:", e.message);
        }
    }
}

/**
 * Garante que a tabela supportmessages existe e está atualizada
 * Cria a tabela se não existir e adiciona colunas/índices necessários
 */
async function ensureTable() {
    const sql = `CREATE TABLE IF NOT EXISTS supportmessages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ReferenciaID VARCHAR(13) NOT NULL,
    SenderReferenciaID VARCHAR(13) NULL,
    message TEXT NOT NULL,
    senderType ENUM('user', 'support') DEFAULT 'user',
    replyTo INT NULL,
    threadId INT NULL,
    anonymousSessionId VARCHAR(36) NULL,
    userName VARCHAR(255) NULL,
    userEmail VARCHAR(255) NULL,
    discordChannelId VARCHAR(20) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ReferenciaID (ReferenciaID),
    FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
    INDEX idx_replyTo (replyTo),
    INDEX idx_threadId (threadId),
    INDEX idx_createdAt (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    await pool.query(sql);

    await addColumnIfMissing("supportmessages", "SenderReferenciaID", "VARCHAR(13) NULL");
    await addColumnIfMissing("supportmessages", "senderType", "VARCHAR(100) DEFAULT 'user'");
    await addColumnIfMissing("supportmessages", "replyTo", "INTEGER NULL");
    await addColumnIfMissing("supportmessages", "threadId", "INTEGER NULL");
    await addColumnIfMissing("supportmessages", "anonymousSessionId", "VARCHAR(36) NULL");
    await addColumnIfMissing("supportmessages", "userName", "VARCHAR(255) NULL");
    await addColumnIfMissing("supportmessages", "userEmail", "VARCHAR(255) NULL");
    await addColumnIfMissing("supportmessages", "discordChannelId", "VARCHAR(20) NULL");

    await pool.query("UPDATE supportmessages SET SenderReferenciaID = ReferenciaID WHERE SenderReferenciaID IS NULL");
    await createIndexIfMissing("idx_supportmessages_referenciaid", "supportmessages", "ReferenciaID");
    await createIndexIfMissing("idx_supportmessages_senderreferenciaid", "supportmessages", "SenderReferenciaID");
    await createIndexIfMissing("idx_supportmessages_replyto", "supportmessages", "replyTo");
    await createIndexIfMissing("idx_supportmessages_threadid", "supportmessages", "threadId");
    await createIndexIfMissing("idx_supportmessages_createdat", "supportmessages", "createdAt");
    await createIndexIfMissing("idx_supportmessages_anonymoussessionid", "supportmessages", "anonymousSessionId");

    await ensureAnonUser();
    await ensureSupportTicketClosuresTable();

    // Foreign keys (podem falhar se já existirem ou houver dados inconsistentes)
    try {
        await pool.query("ALTER TABLE supportmessages ADD CONSTRAINT fk_replyTo FOREIGN KEY (replyTo) REFERENCES supportmessages(id) ON DELETE CASCADE");
    } catch (e) {
        // Foreign key já existe ou não pode ser criada
    }

    try {
        await pool.query("ALTER TABLE supportmessages ADD CONSTRAINT fk_threadId FOREIGN KEY (threadId) REFERENCES supportmessages(id) ON DELETE SET NULL");
    } catch (e) {
        // Foreign key já existe ou não pode ser criada
    }
}

/**
 * Tabela de encerramentos: guarda quem fechou cada ticket (para associar à review de suporte)
 */
async function ensureSupportTicketClosuresTable() {
    try {
        if (!(await tableExists("support_ticket_closures"))) {
            await pool.query(`
                CREATE TABLE support_ticket_closures (
                    threadId INT PRIMARY KEY,
                    ClosedByReferenciaID VARCHAR(13) NOT NULL,
                    ClosedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UserReferenciaID VARCHAR(13) NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log("[SUPPORT] Tabela support_ticket_closures criada");
        }
        await createIndexIfMissing("idx_support_ticket_closures_user", "support_ticket_closures", "UserReferenciaID");
        await createIndexIfMissing("idx_support_ticket_closures_closed_by", "support_ticket_closures", "ClosedByReferenciaID");
    } catch (e) {
        console.error("[SUPPORT] ensureSupportTicketClosuresTable:", e.message);
    }
}

/**
 * Verificar se o usuário é admin
 */
async function verifyAdminSupport(req, res, next) {
    try {
        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        const [rows] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (rows.length === 0 || (rows[0].PerfilId !== 1)) {
            return res.status(403).json({
                status: "error",
                error: "Acesso negado. Apenas administradores."
            });
        }

        next();
    } catch (err) {
        console.error("[SUPPORT] Erro ao verificar admin:", err);
        return res.status(500).json({
            status: "error",
            error: "Erro ao verificar permissões"
        });
    }
}

/**
 * GET /api/support/messages/admin
 * 
 * Lista TODAS as threads de todos os utilizadores (sem filtro)
 * Usado pelo Painel Administrativo para visualizar todas as conversas
 * 
 * Query params:
 * - limit: Número máximo de threads (padrão: 20, máximo: 100)
 * - threadId: Se fornecido, retorna mensagens dessa thread específica
 */
router.get("/messages/admin", verifyToken, verifyAdminSupport, async (req, res) => {
    try {
        await ensureTable();
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const threadId = req.query.threadId;

        console.log("[SUPPORT ADMIN] Buscando mensagens (admin)");
        console.log("[SUPPORT ADMIN] Thread ID:", threadId || "Todas");
        console.log("[SUPPORT ADMIN] Limit:", limit);

        if (threadId) {
            // Buscar mensagens de uma thread específica
            const [messages] = await pool.query(
                `SELECT 
          sm.id, 
          sm.message, 
          sm.senderType, 
          sm.replyTo, 
          sm.threadId, 
          sm.createdAt,
          sm.ReferenciaID,
          u.Nome as userName,
          u.Email as userEmail,
          u.PerfilId as userPerfilId
         FROM supportmessages sm
         LEFT JOIN utilizadores u ON sm.ReferenciaID COLLATE utf8mb4_unicode_ci = u.ReferenciaID COLLATE utf8mb4_unicode_ci
         WHERE sm.id = ? OR sm.threadId = ?
         ORDER BY sm.createdAt ASC`,
                [threadId, threadId]
            );

            const formattedMessages = messages.map(msg => ({
                id: msg.id,
                threadId: msg.threadId || msg.id,
                message: msg.message,
                senderType: msg.senderType,
                ReferenciaID: msg.ReferenciaID,
                userName: msg.userName || "Usuário",
                userEmail: msg.userEmail || "",
                userPerfilId: msg.userPerfilId || null,
                createdAt: msg.createdAt,
                timestamp: new Date(msg.createdAt).getTime() / 1000
            }));

            console.log(`[SUPPORT ADMIN] Retornando ${formattedMessages.length} mensagens da thread ${threadId}`);
            return res.json(formattedMessages);
        }

        // Buscar todas as threads (primeiras mensagens de cada conversa)
        const [threads] = await pool.query(
            `SELECT 
        m.id, 
        m.threadId,
        m.message, 
        m.senderType,
        m.createdAt,
        m.ReferenciaID,
        u.Nome as userName,
        u.Email as userEmail,
        u.PerfilId as userPerfilId,
        COUNT(DISTINCT r.id) as replyCount,
        MAX(r.createdAt) as lastReplyAt
       FROM supportmessages m
       LEFT JOIN supportmessages r ON (r.threadId = m.id OR r.replyTo = m.id)
       LEFT JOIN utilizadores u ON m.ReferenciaID COLLATE utf8mb4_unicode_ci = u.ReferenciaID COLLATE utf8mb4_unicode_ci
       WHERE m.threadId IS NULL OR m.id = m.threadId
       GROUP BY m.id, m.threadId, m.message, m.senderType, m.createdAt, m.ReferenciaID, u.Nome, u.Email, u.PerfilId
       ORDER BY COALESCE(MAX(r.createdAt), m.createdAt) DESC
       LIMIT ?`,
            [limit]
        );

        const formattedThreads = threads.map(thread => ({
            id: thread.id,
            threadId: thread.threadId || thread.id,
            message: thread.message,
            senderType: thread.senderType,
            ReferenciaID: thread.ReferenciaID,
            userName: thread.userName || "Usuário",
            userEmail: thread.userEmail || "",
            userPerfilId: thread.userPerfilId || null,
            createdAt: thread.createdAt,
            replyCount: thread.replyCount || 0,
            timestamp: new Date(thread.createdAt).getTime() / 1000
        }));

        const adminCount = threads.filter(t => t.userPerfilId === 1).length;
        const userCount = threads.filter(t => t.userPerfilId === 2).length;

        console.log(`[SUPPORT ADMIN] Retornando ${formattedThreads.length} threads (Admin: ${adminCount}, User: ${userCount})`);
        res.json({
            items: formattedThreads,
            total: formattedThreads.length
        });
    } catch (error) {
        console.error("[SUPPORT ADMIN] Erro:", error.message);
        res.status(500).json({
            error: "Erro ao listar mensagens",
            details: error.message
        });
    }
});

/**
 * GET /api/support/messages
 * 
 * Lista threads do utilizador autenticado
 * Cada thread representa uma conversa separada
 * 
 * Query params:
 * - limit: Número máximo de threads (padrão: 10, máximo: 50)
 * - threadId: Se fornecido, retorna mensagens dessa thread específica
 * - anonymousId: Se utilizador não está logado, UUID da sessão anónima (obrigatório sem token)
 */
router.get("/messages", optionalToken, async (req, res) => {
    try {
        await ensureTable();
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;
        const threadId = req.query.threadId;
        const anonymousId = req.query.anonymousId;

        const isAnonymous = !req.user && anonymousId;
        const referenciaID = req.user ? req.user.ReferenciaID : ANON_REFERENCIA_ID;

        if (!req.user && !anonymousId) {
            return res.status(401).json({
                error: "Token ou anonymousId é obrigatório",
                code: "ANONYMOUS_ID_REQUIRED"
            });
        }

        if (threadId) {
            const whereClause = isAnonymous
                ? `(sm.id = ? OR sm.threadid = ?) AND sm.ReferenciaID = ? AND sm.anonymoussessionid = ?`
                : `(sm.id = ? OR sm.threadid = ?) AND sm.ReferenciaID = ?`;
            const params = isAnonymous
                ? [threadId, threadId, ANON_REFERENCIA_ID, anonymousId]
                : [threadId, threadId, referenciaID];
            const [messages] = await pool.query(
                `SELECT
           sm.id,
           sm.message,
           sm.ReferenciaID AS "referenciaId",
           sm.sendertype AS "senderType",
           sm.replyto AS "replyTo",
           sm.threadid AS "threadId",
           sm.createdat AS "createdAt",
           COALESCE(sm.username, u.Nome) AS "userName",
           COALESCE(sm.useremail, u.Email) AS "userEmail"
         FROM supportmessages sm
         LEFT JOIN utilizadores u ON u.ReferenciaID = sm.ReferenciaID
         WHERE ${whereClause}
         ORDER BY sm.createdat ASC`,
                params
            );
            return res.json({ items: messages });
        }

        const whereClause = isAnonymous
            ? `m.ReferenciaID = ? AND (m.threadId IS NULL OR m.id = m.threadId) AND m.anonymousSessionId = ?`
            : `m.ReferenciaID = ? AND (m.threadId IS NULL OR m.id = m.threadId)`;
        const whereParams = isAnonymous ? [ANON_REFERENCIA_ID, anonymousId] : [referenciaID];

        const [countResult] = await pool.query(
            `SELECT COUNT(DISTINCT m.id) as total FROM supportmessages m WHERE ${whereClause}`,
            whereParams
        );
        const totalThreads = (countResult[0] && countResult[0].total) ? countResult[0].total : 0;
        const totalPages = Math.ceil(totalThreads / limit);

        const [threads] = await pool.query(
            `SELECT 
        m.id,
        m.message,
        m.ReferenciaID AS "referenciaId",
        m.sendertype AS "senderType",
        m.createdat AS "createdAt",
        COALESCE(m.username, u.Nome) AS "userName",
        COALESCE(m.useremail, u.Email) AS "userEmail",
        COUNT(DISTINCT r.id) as "replyCount",
        MAX(r.createdat) as "lastReplyAt"
       FROM supportmessages m
       LEFT JOIN supportmessages r ON (r.threadid = m.id OR r.replyto = m.id)
       LEFT JOIN utilizadores u ON u.ReferenciaID = m.ReferenciaID
       WHERE ${whereClause}
       GROUP BY m.id, m.message, m.sendertype, m.createdat, m.username, m.useremail, u.Nome, u.Email
       ORDER BY COALESCE(MAX(r.createdat), m.createdat) DESC
       LIMIT ? OFFSET ?`,
            [...whereParams, limit, offset]
        );

        res.json({
            items: threads,
            pagination: {
                page,
                limit,
                total: totalThreads,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao listar mensagens:", error);
        res.status(500).json({ error: "Erro ao listar mensagens" });
    }
});

/**
 * GET /api/support/messages/:id
 * 
 * Obtém uma thread específica com todas as suas respostas.
 * Aceita utilizador logado (token) ou anónimo (anonymousId em query).
 */
router.get("/messages/:id", optionalToken, async (req, res) => {
    try {
        await ensureTable();
        const messageId = parseInt(req.params.id);
        const anonymousId = req.query.anonymousId;
        const isAnonymous = !req.user && anonymousId;

        if (!req.user && !anonymousId) {
            return res.status(401).json({
                error: "Token ou anonymousId é obrigatório",
                code: "ANONYMOUS_ID_REQUIRED"
            });
        }

        const [messages] = await pool.query(
            isAnonymous
                ? `SELECT id, message, senderType, replyTo, threadId, createdAt 
                   FROM supportmessages 
                   WHERE id = ? AND ReferenciaID = ? AND anonymousSessionId = ?`
                : `SELECT id, message, senderType, replyTo, threadId, createdAt 
                   FROM supportmessages 
                   WHERE id = ? AND ReferenciaID = ?`,
            isAnonymous ? [messageId, ANON_REFERENCIA_ID, anonymousId] : [messageId, req.user.ReferenciaID]
        );

        if (messages.length === 0) {
            return res.status(404).json({ error: "Mensagem não encontrada" });
        }

        const mainMessage = messages[0];
        const threadId = mainMessage.threadId || mainMessage.id;

        const [replies] = await pool.query(
            `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM supportmessages 
       WHERE (threadId = ? OR replyTo = ?) AND id != ?
       ORDER BY createdAt ASC`,
            [threadId, messageId, messageId]
        );

        res.json({ message: mainMessage, replies: replies });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao obter mensagem:", error);
        res.status(500).json({ error: "Erro ao obter mensagem" });
    }
});

/**
 * POST /api/support/messages/:id/reply
 * 
 * Responde a uma mensagem existente. Aceita utilizador logado (token) ou anónimo (anonymousId no body).
 */
router.post("/messages/:id/reply", optionalToken, async (req, res) => {
    try {
        await ensureTable();
        const messageId = parseInt(req.params.id);
        const { message, senderType = 'user', anonymousId } = req.body || {};
        const referenciaID = req.user ? req.user.ReferenciaID : null;
        const isAnonymous = !req.user && anonymousId;

        if (!req.user && !anonymousId) {
            return res.status(401).json({
                error: "Token ou anonymousId é obrigatório",
                code: "ANONYMOUS_ID_REQUIRED"
            });
        }

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "Mensagem é obrigatória" });
        }
        if (!['user', 'support'].includes(senderType)) {
            return res.status(400).json({ error: "senderType deve ser 'user' ou 'support'" });
        }

        const [originalMessage] = await pool.query(
            "SELECT id, ReferenciaID, threadId, anonymousSessionId FROM supportmessages WHERE id = ?",
            [messageId]
        );
        if (originalMessage.length === 0) {
            return res.status(404).json({ error: "Mensagem original não encontrada" });
        }

        const threadId = originalMessage[0].threadId || originalMessage[0].id;
        const refOriginal = originalMessage[0].ReferenciaID;
        const anonSessionOriginal = originalMessage[0].anonymousSessionId;

        if (senderType === 'user') {
            if (isAnonymous) {
                if (refOriginal !== ANON_REFERENCIA_ID || anonSessionOriginal !== anonymousId) {
                    return res.status(403).json({ error: "Você não pode responder esta mensagem" });
                }
            } else if (refOriginal !== referenciaID) {
                return res.status(403).json({ error: "Você não pode responder esta mensagem" });
            }
        }

        const referenciaIDParaResposta = refOriginal;
        const senderReferenciaID = senderType === 'support'
            ? referenciaID
            : (isAnonymous ? ANON_REFERENCIA_ID : referenciaID);

        const [insertResult] = await pool.query(
            `INSERT INTO supportmessages (ReferenciaID, SenderReferenciaID, message, senderType, replyTo, threadId)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [referenciaIDParaResposta, senderReferenciaID, message.trim(), senderType, messageId, threadId]
        );
        const newId = insertResult.insertId;

        res.status(201).json({
            id: newId,
            message: message.trim(),
            senderType,
            replyTo: messageId,
            threadId,
            ReferenciaID: referenciaIDParaResposta,
            SenderReferenciaID: senderReferenciaID
        });

        setImmediate(async () => {
            try {
                const [rows] = await pool.query(
                    "SELECT discordChannelId, message AS rootMessage, userName, userEmail FROM supportmessages WHERE id = ? LIMIT 1",
                    [threadId]
                );
                let channelId = rows.length > 0 ? rows[0].discordChannelId : null;
                const root = rows[0];

                // Se a thread ainda não tem canal no Discord (criada antes da integração ou falha na criação), criar agora
                if (!channelId && root) {
                    console.log(" [SUPPORT] Thread", threadId, "sem canal Discord; a criar canal agora (fallback).");
                    channelId = await createTicketChannel(
                        threadId,
                        root.rootMessage || "(sem mensagem)",
                        root.userName || "",
                        root.userEmail || ""
                    );
                    if (channelId) {
                        await pool.query("UPDATE supportmessages SET discordChannelId = ? WHERE id = ?", [channelId, threadId]);
                        console.log(" [SUPPORT] Canal Discord criado para thread", threadId, ", channelId:", channelId);
                    } else {
                        console.warn(" [SUPPORT] Não foi possível criar canal Discord para thread", threadId, "(bot a correr na porta 3001?)");
                    }
                }

                if (channelId) {
                    await sendMessageToChannel(channelId, message.trim(), senderType);
                } else {
                    console.warn(" [SUPPORT] Resposta não enviada para Discord: thread", threadId, "sem canal (verifique o bot na porta 3001).");
                }
            } catch (e) {
                console.error(" [SUPPORT] Erro ao notificar Discord (resposta):", e.message);
            }
        });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao criar resposta:", error);
        res.status(500).json({ error: "Erro ao enviar resposta", details: error.message });
    }
});

/**
 * POST /api/support/internal/threads/:threadId/reply
 * Resposta do suporte enviada pelo Discord (só o bot chama).
 * Header: X-Internal-Secret = SUPPORT_DISCORD_INTERNAL_SECRET do .env
 */
router.post("/internal/threads/:threadId/reply", async (req, res) => {
    try {
        const secret = process.env.SUPPORT_DISCORD_INTERNAL_SECRET;
        if (!secret || req.headers["x-internal-secret"] !== secret) {
            return res.status(403).json({ error: "Não autorizado" });
        }
        await ensureTable();
        const threadId = parseInt(req.params.threadId, 10);
        const { message } = req.body || {};
        if (!threadId || Number.isNaN(threadId) || !message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "threadId e message são obrigatórios" });
        }

        const [root] = await pool.query(
            "SELECT id, ReferenciaID FROM supportmessages WHERE id = ? LIMIT 1",
            [threadId]
        );
        if (root.length === 0) {
            return res.status(404).json({ error: "Thread não encontrada" });
        }
        const referenciaID = root[0].ReferenciaID;
        const rootId = root[0].id;
        const discordUserId = req.body?.discordUserId ? String(req.body.discordUserId) : null;
        let senderReferenciaID = null;

        if (discordUserId) {
            const [staffRows] = await pool.query(
                "SELECT ReferenciaID FROM utilizadores WHERE discord_id = ? LIMIT 1",
                [discordUserId]
            );
            if (staffRows.length > 0) {
                senderReferenciaID = staffRows[0].ReferenciaID;
            }
        }

        await pool.query(
            `INSERT INTO supportmessages (ReferenciaID, SenderReferenciaID, message, senderType, replyTo, threadId) VALUES (?, ?, ?, 'support', ?, ?)`,
            [referenciaID, senderReferenciaID, message.trim(), rootId, threadId]
        );
        console.log(" [SUPPORT] Resposta do Discord guardada para thread", threadId);
        return res.status(201).json({ status: "ok", threadId });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao guardar resposta do Discord:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/support/internal/threads/:threadId/close
 * Fecha o ticket e apaga da base de dados (chamado pelo bot Discord ao clicar "Fechar ticket").
 * Header: X-Internal-Secret = SUPPORT_DISCORD_INTERNAL_SECRET do .env
 */
router.post("/internal/threads/:threadId/close", async (req, res) => {
    try {
        const secret = process.env.SUPPORT_DISCORD_INTERNAL_SECRET;
        if (!secret || req.headers["x-internal-secret"] !== secret) {
            return res.status(403).json({ error: "Não autorizado" });
        }
        await ensureTable();
        const threadId = parseInt(req.params.threadId, 10);
        const { closedByReferenciaID, closedByDiscordId } = req.body || {};
        if (!threadId || Number.isNaN(threadId)) {
            return res.status(400).json({ error: "threadId inválido" });
        }

        const [exists] = await pool.query(
            "SELECT id, ReferenciaID FROM supportmessages WHERE id = ? OR threadId = ? ORDER BY id ASC LIMIT 1",
            [threadId, threadId]
        );
        if (exists.length === 0) {
            return res.status(404).json({ error: "Thread não encontrada" });
        }

        let closedByRef = closedByReferenciaID || null;
        if (!closedByRef && closedByDiscordId) {
            const [u] = await pool.query("SELECT ReferenciaID FROM utilizadores WHERE discord_id = ? LIMIT 1", [String(closedByDiscordId)]);
            if (u.length > 0) closedByRef = u[0].ReferenciaID;
        }
        const userRef = exists[0].ReferenciaID;
        if (closedByRef) {
            try {
                const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'support_ticket_closures'");
                if (tables.length > 0) {
                    await pool.query(
                        "INSERT INTO support_ticket_closures (threadId, ClosedByReferenciaID, UserReferenciaID) VALUES (?, ?, ?) ON CONFLICT (threadId) DO UPDATE SET ClosedByReferenciaID = EXCLUDED.ClosedByReferenciaID, ClosedAt = CURRENT_TIMESTAMP",
                        [threadId, closedByRef, userRef]
                    );
                }
            } catch (e) {
                console.warn("[SUPPORT] Ao guardar closure (Discord):", e.message);
            }
        }

        await pool.query(
            "DELETE FROM supportmessages WHERE id = ? OR threadId = ?",
            [threadId, threadId]
        );
        console.log(" [SUPPORT] Thread", threadId, "fechada e apagada da base de dados (via Discord).");
        return res.json({ status: "ok", threadId });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao fechar thread:", error);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/support/closed-tickets
 * Lista tickets fechados do utilizador logado (para poder escolher qual avaliar)
 */
router.get("/closed-tickets", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const userRef = req.user.ReferenciaID;
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'support_ticket_closures'");
        if (tables.length === 0) {
            return res.json({ status: "ok", items: [] });
        }
        const [rows] = await pool.query(
            `SELECT c.threadId, c.ClosedAt, c.ClosedByReferenciaID, u.Nome AS closedByName, u.Email AS closedByEmail
             FROM support_ticket_closures c
             LEFT JOIN utilizadores u ON u.ReferenciaID = c.ClosedByReferenciaID
             WHERE c.UserReferenciaID = ?
             ORDER BY c.ClosedAt DESC
             LIMIT 50`,
            [userRef]
        );
        res.json({ status: "ok", items: rows });
    } catch (e) {
        console.error("[SUPPORT] closed-tickets:", e);
        res.status(500).json({ status: "error", error: e.message });
    }
});

/**
 * POST /api/support/review
 * Criar avaliação (review). Se tipo=suporte e threadId for enviado, associa ao suporte que fechou esse ticket.
 */
router.post("/review", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const { tipo, texto, rating, is_anonimo, threadId } = req.body || {};
        const referenciaID = req.user.ReferenciaID;

        if (!tipo || !texto || typeof texto !== "string" || !texto.trim()) {
            return res.status(400).json({ status: "error", error: "tipo e texto são obrigatórios" });
        }
        const tipos = ["site", "bot", "suporte"];
        if (!tipos.includes(tipo)) {
            return res.status(400).json({ status: "error", error: "tipo deve ser site, bot ou suporte" });
        }

        let supportReferenciaID = null;
        if (tipo === "suporte" && threadId) {
            const [closures] = await pool.query(
                "SELECT ClosedByReferenciaID FROM support_ticket_closures WHERE threadId = ? AND UserReferenciaID = ? LIMIT 1",
                [parseInt(threadId, 10), referenciaID]
            );
            if (closures.length > 0) {
                supportReferenciaID = closures[0].ClosedByReferenciaID;
            }
        }

        const [cols] = await pool.query(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'SupportReferenciaID'"
        );
        const hasSupportRef = cols.length > 0;

        if (hasSupportRef && supportReferenciaID) {
            await pool.query(
                `INSERT INTO reviews (ReferenciaID, Tipo, Texto, Rating, IsAnonimo, SupportReferenciaID) VALUES (?, ?, ?, ?, ?, ?)`,
                [referenciaID, tipo, texto.trim(), rating != null ? parseInt(rating, 10) : null, is_anonimo ? 1 : 0, supportReferenciaID]
            );
        } else {
            await pool.query(
                `INSERT INTO reviews (ReferenciaID, Tipo, Texto, Rating, IsAnonimo) VALUES (?, ?, ?, ?, ?)`,
                [referenciaID, tipo, texto.trim(), rating != null ? parseInt(rating, 10) : null, is_anonimo ? 1 : 0]
            );
        }

        res.json({ status: "ok", message: "Avaliação guardada com sucesso" });
    } catch (e) {
        console.error("[SUPPORT] review:", e);
        res.status(500).json({ status: "error", error: e.message });
    }
});

/**
 * POST /api/support/messages
 * Cria nova thread. Aceita utilizador logado (token) ou anónimo (anonymousId no body).
 */
router.post("/messages", optionalToken, async (req, res) => {
    try {
        await ensureTable();
        const { message, anonymousId, userName, userEmail } = req.body || {};
        const isAnonymous = !req.user;
        const referenciaID = req.user ? req.user.ReferenciaID : ANON_REFERENCIA_ID;

        if (!req.user && !anonymousId) {
            return res.status(401).json({
                error: "Token ou anonymousId é obrigatório (utilizador anónimo deve enviar anonymousId)",
                code: "ANONYMOUS_ID_REQUIRED"
            });
        }

        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({ error: "Mensagem é obrigatória" });
        }

        const nameStr = typeof userName === "string" ? userName.trim() : "";
        const emailStr = typeof userEmail === "string" ? userEmail.trim() : "";

        if (req.user) {
            const [userInfo] = await pool.query(
                "SELECT ReferenciaID, Nome, Email, PerfilId FROM utilizadores WHERE ReferenciaID = ?",
                [referenciaID]
            );
            if (userInfo.length > 0) {
                const perfil = userInfo[0].PerfilId === 1 ? 'Admin' : userInfo[0].PerfilId === 2 ? 'User' : 'Desconhecido';
                console.log(" [SUPPORT] Utilizador:", { ReferenciaID: userInfo[0].ReferenciaID, nome: userInfo[0].Nome, perfil });
            }
        } else {
            console.log(" [SUPPORT] Nova mensagem anónima (anonymousId:", anonymousId?.substring?.(0, 8) + "...)");
        }

        const [result] = await pool.query(
            isAnonymous
                ? "INSERT INTO supportmessages (ReferenciaID, SenderReferenciaID, message, userName, userEmail, senderType, anonymousSessionId) VALUES (?, ?, ?, ?, ?, 'user', ?)"
                : "INSERT INTO supportmessages (ReferenciaID, SenderReferenciaID, message, userName, userEmail, senderType) VALUES (?, ?, ?, ?, ?, 'user')",
            isAnonymous
                ? [ANON_REFERENCIA_ID, ANON_REFERENCIA_ID, message.trim(), nameStr || null, emailStr || null, anonymousId]
                : [referenciaID, referenciaID, message.trim(), nameStr || null, emailStr || null]
        );

        const newMessageId = result.insertId;

        await pool.query(
            "UPDATE supportmessages SET threadId = ? WHERE id = ?",
            [newMessageId, newMessageId]
        );

        console.log(" [SUPPORT] Nova thread criada:", newMessageId);

        res.status(201).json({
            id: newMessageId,
            message: message.trim(),
            senderType: 'user',
            threadId: newMessageId,
            ReferenciaID: referenciaID
        });

        setImmediate(async () => {
            try {
                console.log(" [SUPPORT] A criar ticket no Discord para thread", newMessageId);
                const channelId = await createTicketChannel(newMessageId, message.trim(), nameStr, emailStr);
                if (channelId) {
                    await pool.query("UPDATE supportmessages SET discordChannelId = ? WHERE id = ?", [channelId, newMessageId]);
                    console.log(" [SUPPORT] Ticket Discord guardado, channelId:", channelId);
                } else {
                    console.warn(" [SUPPORT] Não foi possível criar ticket no Discord para thread", newMessageId, "(bot na porta 3001? DISCORD_GUILD_ID no .env?)");
                }
            } catch (e) {
                console.error("Erro ao criar ticket Discord:", e.message);
            }
        });
    } catch (error) {
        console.error("Erro ao criar mensagem:", error);
        res.status(500).json({
            error: "Erro ao enviar mensagem",
            details: error.message
        });
    }
});

/**
 * DELETE /api/support/messages/:id
 * 
 * Exclui uma thread (conversa) e todas as suas mensagens
 */
router.delete("/messages/:id", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const threadId = parseInt(req.params.id);
        const referenciaID = req.user.ReferenciaID;

        // Verificar se o usuário é admin
        const [userRows] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (userRows.length === 0 || userRows[0].PerfilId !== 1) {
            return res.status(403).json({
                error: "Apenas administradores podem excluir conversas"
            });
        }

        // Verificar se a thread existe e obter ReferenciaID do utilizador (cliente) da conversa
        const [threadRows] = await pool.query(
            "SELECT id, ReferenciaID FROM supportmessages WHERE id = ? OR threadId = ? ORDER BY id ASC LIMIT 1",
            [threadId, threadId]
        );

        if (threadRows.length === 0) {
            return res.status(404).json({
                error: "Conversa não encontrada"
            });
        }

        const userReferenciaID = threadRows[0].ReferenciaID;
        // Guardar quem fechou (para associar à review de suporte)
        try {
            await pool.query(
                "INSERT INTO support_ticket_closures (threadId, ClosedByReferenciaID, UserReferenciaID) VALUES (?, ?, ?) ON CONFLICT (threadId) DO UPDATE SET ClosedByReferenciaID = EXCLUDED.ClosedByReferenciaID, ClosedAt = CURRENT_TIMESTAMP",
                [threadId, referenciaID, userReferenciaID]
            );
        } catch (e) {
            console.warn("[SUPPORT] Ao guardar closure:", e.message);
        }

        // Excluir todas as mensagens da thread
        await pool.query(
            "DELETE FROM supportmessages WHERE id = ? OR threadId = ?",
            [threadId, threadId]
        );

        console.log(`[SUPPORT] Thread ${threadId} excluída por admin ${referenciaID}`);

        res.json({
            status: "ok",
            message: "Conversa excluída com sucesso"
        });
    } catch (error) {
        console.error("[SUPPORT] Erro ao excluir thread:", error);
        res.status(500).json({
            error: "Erro ao excluir conversa",
            details: error.message
        });
    }
});

export default router;
