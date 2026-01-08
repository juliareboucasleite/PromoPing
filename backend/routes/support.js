/**
 * PromoPing Support API Routes
 * 
 * Sistema de suporte ao cliente com threads e mensagens.
 * Cada utilizador pode ter múltiplas threads (conversas) distintas.
 * 
 * Endpoints:
 * - GET  /api/support/messages/admin - Listar todas as threads (admin)
 * - GET  /api/support/messages - Listar threads do utilizador autenticado
 * - GET  /api/support/messages/:id - Obter thread específica com respostas
 * - POST /api/support/messages - Criar nova thread (nova conversa)
 * - POST /api/support/messages/:id/reply - Responder à thread existente
 */

import express from "express";
import {
    pool
} from "../database/db.js";
import {
    verifyToken
} from "../middleware/auth.js";

const router = express.Router();

// ============================================================================
// UTILITÁRIOS DE BASE DE DADOS
// ============================================================================

/**
 * Garante que a tabela supportmessages existe e está atualizada
 * Cria a tabela se não existir e adiciona colunas/índices necessários
 */
async function ensureTable() {
    const sql = `CREATE TABLE IF NOT EXISTS supportmessages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ReferenciaID VARCHAR(13) NOT NULL,
    message TEXT NOT NULL,
    senderType ENUM('user', 'support') DEFAULT 'user',
    replyTo INT NULL,
    threadId INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ReferenciaID (ReferenciaID),
    FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
    INDEX idx_replyTo (replyTo),
    INDEX idx_threadId (threadId),
    INDEX idx_createdAt (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    await pool.query(sql);

    // Migrações: adicionar colunas se não existirem
    const migrations = [
        "ALTER TABLE supportmessages ADD COLUMN senderType ENUM('user', 'support') DEFAULT 'user'",
        "ALTER TABLE supportmessages ADD COLUMN replyTo INT NULL",
        "ALTER TABLE supportmessages ADD COLUMN threadId INT NULL",
        "ALTER TABLE supportmessages ADD INDEX idx_replyTo (replyTo)",
        "ALTER TABLE supportmessages ADD INDEX idx_threadId (threadId)"
    ];

    for (const migration of migrations) {
        try {
            await pool.query(migration);
        } catch (e) {
            // Coluna/índice já existe, ignorar
        }
    }

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

// ============================================================================
// ENDPOINTS ADMINISTRATIVOS (Com autenticação JWT - para Painel Admin)
// ============================================================================

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

// ============================================================================
// ENDPOINTS DE UTILIZADOR (Requer autenticação JWT)
// ============================================================================

/**
 * GET /api/support/messages
 * 
 * Lista threads do utilizador autenticado
 * Cada thread representa uma conversa separada
 * 
 * Query params:
 * - limit: Número máximo de threads (padrão: 10, máximo: 50)
 * - threadId: Se fornecido, retorna mensagens dessa thread específica
 */
router.get("/messages", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const referenciaID = req.user.ReferenciaID; // ReferenciaID do token JWT
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const offset = (page - 1) * limit;
        const threadId = req.query.threadId;

        console.log(" [SUPPORT] Listando mensagens para ReferenciaID:", referenciaID, "page:", page);

        if (threadId) {
            // Buscar mensagens de uma thread específica do utilizador
            const [messages] = await pool.query(
                `SELECT id, message, senderType, replyTo, threadId, createdAt 
         FROM supportmessages 
         WHERE (id = ? OR threadId = ?) AND ReferenciaID = ?
         ORDER BY createdAt ASC`,
                [threadId, threadId, referenciaID]
            );

            return res.json({
                items: messages
            });
        }

        // Buscar threads do utilizador com paginação (primeiras mensagens de cada conversa)
        // IMPORTANTE: threadId IS NULL OR m.id = m.threadId garante que pegamos apenas a primeira mensagem de cada thread

        // Query para contar total de threads (para paginação)
        const [countResult] = await pool.query(
            `SELECT COUNT(DISTINCT m.id) as total
       FROM supportmessages m
       WHERE m.ReferenciaID = ? AND (m.threadId IS NULL OR m.id = m.threadId)`,
            [referenciaID]
        );
        const totalThreads = (countResult[0] && countResult[0].total) ? countResult[0].total : 0;
        const totalPages = Math.ceil(totalThreads / limit);

        // Query para buscar threads com paginação
        const [threads] = await pool.query(
            `SELECT 
        m.id, 
        m.message, 
        m.senderType,
        m.createdAt,
        COUNT(DISTINCT r.id) as replyCount,
        MAX(r.createdAt) as lastReplyAt
       FROM supportmessages m
       LEFT JOIN supportmessages r ON (r.threadId = m.id OR r.replyTo = m.id)
       WHERE m.ReferenciaID = ? AND (m.threadId IS NULL OR m.id = m.threadId)
       GROUP BY m.id
       ORDER BY COALESCE(MAX(r.createdAt), m.createdAt) DESC
       LIMIT ? OFFSET ?`,
            [referenciaID, limit, offset]
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
        res.status(500).json({
            error: "Erro ao listar mensagens"
        });
    }
});

/**
 * GET /api/support/messages/:id
 * 
 * Obtém uma thread específica com todas as suas respostas
 * Valida que a thread pertence ao utilizador autenticado
 */
router.get("/messages/:id", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const referenciaID = req.user.ReferenciaID;
        const messageId = parseInt(req.params.id);

        // Buscar mensagem principal
        const [messages] = await pool.query(
            `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM supportmessages 
       WHERE id = ? AND ReferenciaID = ?`,
            [messageId, referenciaID]
        );

        if (messages.length === 0) {
            return res.status(404).json({
                error: "Mensagem não encontrada"
            });
        }

        const mainMessage = messages[0];
        const threadId = mainMessage.threadId || mainMessage.id;

        // Buscar todas as respostas da thread
        const [replies] = await pool.query(
            `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM supportmessages 
       WHERE (threadId = ? OR replyTo = ?) AND id != ?
       ORDER BY createdAt ASC`,
            [threadId, messageId, messageId]
        );

        res.json({
            message: mainMessage,
            replies: replies
        });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao obter mensagem:", error);
        res.status(500).json({
            error: "Erro ao obter mensagem"
        });
    }
});

/**
 * POST /api/support/messages/:id/reply
 * 
 * Responde a uma mensagem existente (adiciona à thread)
 * 
 * IMPORTANTE: 
 * - Se senderType = 'user', valida que a thread pertence ao utilizador
 * - Se senderType = 'support', permite responder qualquer thread
 */
router.post("/messages/:id/reply", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const referenciaID = req.user.ReferenciaID;
        const messageId = parseInt(req.params.id);
        const {
            message,
            senderType = 'user'
        } = req.body || {};

        console.log(" [SUPPORT] Resposta de mensagem:", {
            messageId,
            referenciaID,
            senderType
        });

        // Validações
        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Mensagem é obrigatória"
            });
        }

        if (!['user', 'support'].includes(senderType)) {
            return res.status(400).json({
                error: "senderType deve ser 'user' ou 'support'"
            });
        }

        // Buscar mensagem original
        const [originalMessage] = await pool.query(
            "SELECT id, ReferenciaID, threadId FROM supportmessages WHERE id = ?",
            [messageId]
        );

        if (originalMessage.length === 0) {
            return res.status(404).json({
                error: "Mensagem original não encontrada"
            });
        }

        // Determinar threadId (usa o threadId da mensagem original ou o próprio ID)
        const threadId = originalMessage[0].threadId || originalMessage[0].id;

        // Validação de permissão: usuários só podem responder suas próprias threads
        if (senderType === 'user' && originalMessage[0].ReferenciaID !== referenciaID) {
            return res.status(403).json({
                error: "Você não pode responder esta mensagem"
            });
        }

        // Determinar ReferenciaID para a resposta
        // Se for suporte, mantém o ReferenciaID da mensagem original
        // Se for usuário, usa o ReferenciaID do token
        const referenciaIDParaResposta = senderType === 'support' ?
            originalMessage[0].ReferenciaID :
            referenciaID;

        // Inserir resposta
        const [result] = await pool.query(
            `INSERT INTO supportmessages (ReferenciaID, message, senderType, replyTo, threadId)
             VALUES (?, ?, ?, ?, ?)`,
            [referenciaIDParaResposta, message.trim(), senderType, messageId, threadId]
        );

        console.log(" [SUPPORT] Resposta inserida:", result.insertId);

        res.status(201).json({
            id: result.insertId,
            message: message.trim(),
            senderType: senderType,
            replyTo: messageId,
            threadId: threadId,
            ReferenciaID: referenciaIDParaResposta
        });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao criar resposta:", error);
        res.status(500).json({
            error: "Erro ao enviar resposta",
            details: error.message
        });
    }
});

/**
 * POST /api/support/messages
 * 
 * Cria uma nova thread (nova conversa)
 * 
 * IMPORTANTE:
 * - Cada chamada cria uma NOVA thread (nova conversa)
 * - O threadId é definido como o próprio ID da mensagem (primeira mensagem = thread)
 * - Isso garante que cada utilizador pode ter múltiplas threads distintas
 */
router.post("/messages", verifyToken, async (req, res) => {
    try {
        await ensureTable();
        const referenciaID = req.user.ReferenciaID;
        const {
            message
        } = req.body || {};

        console.log(" [SUPPORT] Nova mensagem de ReferenciaID:", referenciaID);

        // Validações
        if (!message || typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Mensagem é obrigatória"
            });
        }

        // Buscar informações do utilizador para logs
        const [userInfo] = await pool.query(
            "SELECT ReferenciaID, Nome, Email, PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (userInfo.length > 0) {
            const perfil = userInfo[0].PerfilId === 1 ? 'Admin' : userInfo[0].PerfilId === 2 ? 'User' : 'Desconhecido';
            console.log(" [SUPPORT] Utilizador:", {
                ReferenciaID: userInfo[0].ReferenciaID,
                nome: userInfo[0].Nome,
                perfil
            });
        }

        // Inserir nova mensagem (primeira mensagem da thread)
        const [result] = await pool.query(
            "INSERT INTO supportmessages (ReferenciaID, message, senderType) VALUES (?, ?, 'user')",
            [referenciaID, message.trim()]
        );

        const newMessageId = result.insertId;

        // CRÍTICO: Definir threadId como o próprio ID da mensagem
        // Isso cria uma nova thread - cada mensagem inicial = nova conversa
        await pool.query(
            "UPDATE supportmessages SET threadId = ? WHERE id = ?",
            [newMessageId, newMessageId]
        );

        console.log(" [SUPPORT] Nova thread criada:", newMessageId);

        res.status(201).json({
            id: newMessageId,
            message: message.trim(),
            senderType: 'user',
            threadId: newMessageId, // threadId = id (primeira mensagem = thread)
            ReferenciaID: referenciaID
        });
    } catch (error) {
        console.error(" [SUPPORT] Erro ao criar mensagem:", error);
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

        // Verificar se a thread existe
        const [threadRows] = await pool.query(
            "SELECT id FROM supportmessages WHERE id = ? OR threadId = ? LIMIT 1",
            [threadId, threadId]
        );

        if (threadRows.length === 0) {
            return res.status(404).json({
                error: "Conversa não encontrada"
            });
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