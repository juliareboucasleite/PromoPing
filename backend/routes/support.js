// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

async function ensureTable() {
  // Criar tabela se não existir
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
  
  // Adicionar colunas se a tabela já existir (migração)
  try {
    await pool.query("ALTER TABLE SupportMessages ADD COLUMN senderType ENUM('user', 'support') DEFAULT 'user'");
  } catch (e) {
    // Coluna já existe, ignorar
  }
  try {
    await pool.query("ALTER TABLE SupportMessages ADD COLUMN replyTo INT NULL");
  } catch (e) {
    // Coluna já existe, ignorar
  }
  try {
    await pool.query("ALTER TABLE SupportMessages ADD COLUMN threadId INT NULL");
  } catch (e) {
    // Coluna já existe, ignorar
  }
  
  // Adicionar índices se não existirem
  try {
    await pool.query("ALTER TABLE SupportMessages ADD INDEX idx_replyTo (replyTo)");
  } catch (e) {
    // Índice já existe, ignorar
  }
  try {
    await pool.query("ALTER TABLE SupportMessages ADD INDEX idx_threadId (threadId)");
  } catch (e) {
    // Índice já existe, ignorar
  }
  
  // Tentar adicionar foreign keys (pode falhar se já existirem ou se houver dados inconsistentes)
  try {
    await pool.query("ALTER TABLE SupportMessages ADD CONSTRAINT fk_replyTo FOREIGN KEY (replyTo) REFERENCES SupportMessages(id) ON DELETE CASCADE");
  } catch (e) {
    // Foreign key já existe ou não pode ser criada, ignorar
  }
  try {
    await pool.query("ALTER TABLE SupportMessages ADD CONSTRAINT fk_threadId FOREIGN KEY (threadId) REFERENCES SupportMessages(id) ON DELETE SET NULL");
  } catch (e) {
    // Foreign key já existe ou não pode ser criada, ignorar
  }
}

// Listar conversas (threads) do usuário autenticado
router.get("/messages", verifyToken, async (req, res) => {
  try {
    await ensureTable();
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const threadId = req.query.threadId;
    
    if (threadId) {
      // Retornar mensagens de uma thread específica com respostas
      // Inclui a mensagem principal (id = threadId) e todas as respostas (threadId = threadId)
      const [messages] = await pool.query(
        `SELECT id, message, senderType, replyTo, threadId, createdAt 
         FROM SupportMessages 
         WHERE (id = ? OR threadId = ?) AND userId = ?
         ORDER BY createdAt ASC`,
        [threadId, threadId, req.user.id]
      );
      return res.json({ items: messages });
    }
    
    // Retornar threads (primeiras mensagens) com contagem de respostas
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
       LIMIT ?`,
      [req.user.id, limit]
    );
    res.json({ items: threads });
  } catch (e) {
    console.error("Erro ao listar mensagens de suporte:", e);
    res.status(500).json({ error: "Erro ao listar mensagens" });
  }
});

// Obter mensagem específica com respostas
router.get("/messages/:id", verifyToken, async (req, res) => {
  try {
    await ensureTable();
    const messageId = parseInt(req.params.id);
    
    // Buscar mensagem principal
    const [messages] = await pool.query(
      `SELECT id, message, senderType, replyTo, threadId, createdAt 
       FROM SupportMessages 
       WHERE id = ? AND userId = ?`,
      [messageId, req.user.id]
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
  } catch (e) {
    console.error("Erro ao obter mensagem:", e);
    res.status(500).json({ error: "Erro ao obter mensagem" });
  }
});

// Responder a uma mensagem existente (DEVE VIR ANTES de POST /messages)
router.post("/messages/:id/reply", verifyToken, async (req, res) => {
  console.log("[SUPPORT] POST /api/support/messages/:id/reply - Recebida requisição");
  console.log("[SUPPORT] Message ID:", req.params.id);
  console.log("[SUPPORT] Body:", req.body);
  
  try {
    await ensureTable();
    const messageId = parseInt(req.params.id);
    const { message, senderType = 'user' } = req.body || {};
    
    // Validar mensagem
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }
    
    // Validar senderType
    if (!['user', 'support'].includes(senderType)) {
      return res.status(400).json({ error: "senderType deve ser 'user' ou 'support'" });
    }
    
    // Verificar se a mensagem original existe e pertence ao usuário (ou permitir suporte responder)
    const [originalMessage] = await pool.query(
      "SELECT id, userId, threadId FROM SupportMessages WHERE id = ?",
      [messageId]
    );
    
    if (originalMessage.length === 0) {
      return res.status(404).json({ error: "Mensagem original não encontrada" });
    }
    
    // Determinar threadId (usa o threadId da mensagem original ou o próprio ID)
    const threadId = originalMessage[0].threadId || originalMessage[0].id;
    
    // Se for suporte, pode responder qualquer mensagem
    // Se for usuário, só pode responder suas próprias mensagens
    if (senderType === 'user' && originalMessage[0].userId !== req.user.id) {
      return res.status(403).json({ error: "Você não pode responder esta mensagem" });
    }
    
    // Inserir resposta
    const [result] = await pool.query(
      `INSERT INTO SupportMessages (userId, message, senderType, replyTo, threadId) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        senderType === 'support' ? originalMessage[0].userId : req.user.id,
        message.trim(),
        senderType,
        messageId,
        threadId
      ]
    );
    
    console.log("[SUPPORT] Resposta inserida com sucesso, ID:", result.insertId);
    res.status(201).json({ 
      id: result.insertId, 
      message: message.trim(),
      senderType: senderType,
      replyTo: messageId,
      threadId: threadId
    });
  } catch (e) {
    console.error("[SUPPORT] Erro ao criar resposta:", e);
    res.status(500).json({ error: "Erro ao enviar resposta" });
  }
});

// Criar nova mensagem de suporte (DEVE VIR DEPOIS de POST /messages/:id/reply)
router.post("/messages", (req, res, next) => {
  console.log("[SUPPORT] Rota POST /api/support/messages interceptada");
  console.log("[SUPPORT] URL:", req.url);
  console.log("[SUPPORT] Path:", req.path);
  console.log("[SUPPORT] Method:", req.method);
  next();
}, verifyToken, async (req, res) => {
  console.log("[SUPPORT] POST /api/support/messages - Recebida requisição");
  console.log("[SUPPORT] Body:", req.body);
  console.log("[SUPPORT] User ID:", req.user?.id);
  try {
    await ensureTable();
    const { message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      console.log("[SUPPORT] Erro: Mensagem vazia ou inválida");
      return res.status(400).json({ error: "Mensagem é obrigatória" });
    }
    console.log("[SUPPORT] Inserindo mensagem no banco de dados...");
    const [result] = await pool.query(
      "INSERT INTO SupportMessages (userId, message, senderType) VALUES (?, ?, 'user')",
      [req.user.id, message.trim()]
    );
    
    // Atualizar threadId para apontar para si mesmo (primeira mensagem da thread)
    await pool.query(
      "UPDATE SupportMessages SET threadId = ? WHERE id = ?",
      [result.insertId, result.insertId]
    );
    
    console.log("[SUPPORT] Mensagem inserida com sucesso, ID:", result.insertId);
    res.status(201).json({ 
      id: result.insertId, 
      message: message.trim(),
      senderType: 'user',
      threadId: result.insertId
    });
  } catch (e) {
    console.error("[SUPPORT] Erro ao criar mensagem de suporte:", e);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

export default router;


