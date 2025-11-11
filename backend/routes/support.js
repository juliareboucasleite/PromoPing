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
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ============================================================================
// UTILITÁRIOS DE BASE DE DADOS
// ============================================================================

/**
 * Garante que a tabela SupportMessages existe e está atualizada
 * Cria a tabela se não existir e adiciona colunas/índices necessários
 */
async function ensureTable() {
  const sql = `CREATE TABLE IF NOT EXISTS SupportMessages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    message TEXT NOT NULL,
    senderType ENUM('user', 'support') DEFAULT 'user',
    replyTo INT NULL,
    threadId INT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_userId (userId),
    INDEX idx_replyTo (replyTo),
    INDEX idx_threadId (threadId),
    INDEX idx_createdAt (createdAt)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
  
  await pool.query(sql);
  
  // Migrações: adicionar colunas se não existirem
  const migrations = [
    "ALTER TABLE SupportMessages ADD COLUMN senderType ENUM('user', 'support') DEFAULT 'user'",
    "ALTER TABLE SupportMessages ADD COLUMN replyTo INT NULL",
    "ALTER TABLE SupportMessages ADD COLUMN threadId INT NULL",
    "ALTER TABLE SupportMessages ADD INDEX idx_replyTo (replyTo)",
    "ALTER TABLE SupportMessages ADD INDEX idx_threadId (threadId)"
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
    await pool.query("ALTER TABLE SupportMessages ADD CONSTRAINT fk_replyTo FOREIGN KEY (replyTo) REFERENCES SupportMessages(id) ON DELETE CASCADE");
  } catch (e) {
    // Foreign key já existe ou não pode ser criada
  }
  
  try {
    await pool.query("ALTER TABLE SupportMessages ADD CONSTRAINT fk_threadId FOREIGN KEY (threadId) REFERENCES SupportMessages(id) ON DELETE SET NULL");
  } catch (e) {
    // Foreign key já existe ou não pode ser criada
  }
}

// ============================================================================
// ENDPOINTS ADMINISTRATIVOS (Sem autenticação JWT - para Painel Admin)
// ============================================================================

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
router.get("/messages/admin", async (req, res) => {
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
          sm.userId,
          u.Nome as userName,
          u.Email as userEmail,
          u.PerfilId as userPerfilId
         FROM SupportMessages sm
         LEFT JOIN Utilizadores u ON sm.userId = u.Id
         WHERE sm.id = ? OR sm.threadId = ?
         ORDER BY sm.createdAt ASC`,
        [threadId, threadId]
      );
      
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        threadId: msg.threadId || msg.id,
        message: msg.message,
        senderType: msg.senderType,
        userId: msg.userId,
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
        m.message, 
        m.senderType,
        m.createdAt,
        m.userId,
        u.Nome as userName,
        u.Email as userEmail,
        u.PerfilId as userPerfilId,
        COUNT(DISTINCT r.id) as replyCount,
        MAX(r.createdAt) as lastReplyAt
       FROM SupportMessages m
       LEFT JOIN SupportMessages r ON (r.threadId = m.id OR r.replyTo = m.id)
       LEFT JOIN Utilizadores u ON m.userId = u.Id
       WHERE m.threadId IS NULL OR m.id = m.threadId
       GROUP BY m.id
       ORDER BY COALESCE(MAX(r.createdAt), m.createdAt) DESC
       LIMIT ?`,
      [limit]
    );
    
    const formattedThreads = threads.map(thread => ({
      id: thread.id,
      threadId: thread.threadId || thread.id,
      message: thread.message,
      senderType: thread.senderType,
      userId: thread.userId,
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
    res.json({ items: formattedThreads, total: formattedThreads.length });
  } catch (error) {
    console.error("[SUPPORT ADMIN] Erro:", error.message);
    res.status(500).json({ error: "Erro ao listar mensagens", details: error.message });
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
    const userId = req.user.id; // userId do token JWT
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const threadId = req.query.threadId;
    
    console.log(" [SUPPORT] Listando mensagens para userId:", userId, "page:", page);
    
    if (threadId) {
      // Buscar mensagens de uma thread específica do utilizador
      const [messages] = await pool.query(
        `SELECT id, message, senderType, replyTo, threadId, createdAt 
         FROM SupportMessages 
         WHERE (id = ? OR threadId = ?) AND userId = ?
         ORDER BY createdAt ASC`,
        [threadId, threadId, userId]
      );
      
      return res.json({ items: messages });
    }
    
    // Buscar threads do utilizador com paginação (primeiras mensagens de cada conversa)
    // IMPORTANTE: threadId IS NULL OR m.id = m.threadId garante que pegamos apenas a primeira mensagem de cada thread
    
    // Query para contar total de threads (para paginação)
    const [countResult] = await pool.query(
      `SELECT COUNT(DISTINCT m.id) as total
       FROM SupportMessages m
       WHERE m.userId = ? AND (m.threadId IS NULL OR m.id = m.threadId)`,
      [userId]
    );
    const totalThreads = countResult[0]?.total || 0;
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
       FROM SupportMessages m
       LEFT JOIN SupportMessages r ON (r.threadId = m.id OR r.replyTo = m.id)
       WHERE m.userId = ? AND (m.threadId IS NULL OR m.id = m.threadId)
       GROUP BY m.id
       ORDER BY COALESCE(MAX(r.createdAt), m.createdAt) DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
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
 * Obtém uma thread específica com todas as suas respostas
 * Valida que a thread pertence ao utilizador autenticado
 */
router.get("/messages/:id", verifyToken, async (req, res) => {
  try {
    await ensureTable();
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    
    // Buscar mensagem principal
    const [messages] = await pool.query(
      `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM SupportMessages 
       WHERE id = ? AND userId = ?`,
      [messageId, userId]
    );
    
    if (messages.length === 0) {
      return res.status(404).json({ error: "Mensagem não encontrada" });
    }
    
    const mainMessage = messages[0];
    const threadId = mainMessage.threadId || mainMessage.id;
    
    // Buscar todas as respostas da thread
    const [replies] = await pool.query(
      `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM SupportMessages 
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
    res.status(500).json({ error: "Erro ao obter mensagem" });
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
    const userId = req.user.id;
    const messageId = parseInt(req.params.id);
    const { message, senderType = 'user' } = req.body || {};
    
    console.log(" [SUPPORT] Resposta de mensagem:", { messageId, userId, senderType });
    
    // Validações
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }
    
    if (!['user', 'support'].includes(senderType)) {
      return res.status(400).json({ error: "senderType deve ser 'user' ou 'support'" });
    }
    
    // Buscar mensagem original
    const [originalMessage] = await pool.query(
      "SELECT id, userId, threadId FROM SupportMessages WHERE id = ?",
      [messageId]
    );
    
    if (originalMessage.length === 0) {
      return res.status(404).json({ error: "Mensagem original não encontrada" });
    }
    
    // Determinar threadId (usa o threadId da mensagem original ou o próprio ID)
    const threadId = originalMessage[0].threadId || originalMessage[0].id;
    
    // Validação de permissão: usuários só podem responder suas próprias threads
    if (senderType === 'user' && originalMessage[0].userId !== userId) {
      return res.status(403).json({ error: "Você não pode responder esta mensagem" });
    }
    
    // Determinar userId para a resposta
    // Se for suporte, mantém o userId da mensagem original
    // Se for usuário, usa o userId do token
    const userIdParaResposta = senderType === 'support' 
      ? originalMessage[0].userId 
      : userId;
    
    // Inserir resposta
    const [result] = await pool.query(
      `INSERT INTO SupportMessages (userId, message, senderType, replyTo, threadId) 
       VALUES (?, ?, ?, ?, ?)`,
      [userIdParaResposta, message.trim(), senderType, messageId, threadId]
    );
    
    console.log(" [SUPPORT] Resposta inserida:", result.insertId);
    
    res.status(201).json({ 
      id: result.insertId, 
      message: message.trim(),
      senderType: senderType,
      replyTo: messageId,
      threadId: threadId,
      userId: userIdParaResposta
    });
  } catch (error) {
    console.error(" [SUPPORT] Erro ao criar resposta:", error);
    res.status(500).json({ error: "Erro ao enviar resposta", details: error.message });
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
    const userId = req.user.id;
    const { message } = req.body || {};
    
    console.log(" [SUPPORT] Nova mensagem de userId:", userId);
    
    // Validações
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }
    
    // Buscar informações do utilizador para logs
    const [userInfo] = await pool.query(
      "SELECT Id, Nome, Email, PerfilId FROM Utilizadores WHERE Id = ?",
      [userId]
    );
    
    if (userInfo.length > 0) {
      const perfil = userInfo[0].PerfilId === 1 ? 'Admin' : userInfo[0].PerfilId === 2 ? 'User' : 'Desconhecido';
      console.log(" [SUPPORT] Utilizador:", { 
        id: userInfo[0].Id, 
        nome: userInfo[0].Nome, 
        perfil 
      });
    }
    
    // Inserir nova mensagem (primeira mensagem da thread)
    const [result] = await pool.query(
      "INSERT INTO SupportMessages (userId, message, senderType) VALUES (?, ?, 'user')",
      [userId, message.trim()]
    );
    
    const newMessageId = result.insertId;
    
    // CRÍTICO: Definir threadId como o próprio ID da mensagem
    // Isso cria uma nova thread - cada mensagem inicial = nova conversa
    await pool.query(
      "UPDATE SupportMessages SET threadId = ? WHERE id = ?",
      [newMessageId, newMessageId]
    );
    
    console.log(" [SUPPORT] Nova thread criada:", newMessageId);
    
    res.status(201).json({ 
      id: newMessageId, 
      message: message.trim(),
      senderType: 'user',
      threadId: newMessageId, // threadId = id (primeira mensagem = thread)
      userId: userId
    });
  } catch (error) {
    console.error(" [SUPPORT] Erro ao criar mensagem:", error);
    res.status(500).json({ error: "Erro ao enviar mensagem", details: error.message });
  }
});

export default router;
