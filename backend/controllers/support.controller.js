import { v4 as uuidv4 } from "uuid";
import { pool } from "../database/db.js";
import { analyzeMessage } from "../services/aiSupport.service.js";
import { canAiAnswer } from "../services/supportRules.service.js";
import { createTicket as legacyCreateTicket } from "../services/legacySupport.service.js";
import { notifySupportTeam } from "../services/notify.service.js";
import { logSupportAiDecision, logSupportEscalation } from "../utils/logger.js";

const VALID_CONTEXTS = ["index", "dashboard", "product", "plan", "profile"];
const FALLBACK_MESSAGE = "Our support team will review your request and reply shortly.";

async function ensureSupportTicketsTable() {
    const sql = `CREATE TABLE IF NOT EXISTS SupportTickets (
      id CHAR(36) PRIMARY KEY,
      user_id INT NULL,
      referencia_id VARCHAR(13) NULL,
      context VARCHAR(50) NOT NULL,
      channel VARCHAR(50) DEFAULT 'web',
      message TEXT NOT NULL,
      ai_response TEXT NULL,
      ai_confidence DECIMAL(3,2) NULL,
      status ENUM('OPEN','AI_ANSWERED','ESCALATED','CLOSED') DEFAULT 'OPEN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_referencia_id (referencia_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
    await pool.query(sql);
}

/**
 * POST /api/support/ticket
 * Body: { message, context, channel? }
 * Auth: verifyToken (req.user.ReferenciaID)
 */
export async function createTicket(req, res) {
    try {
        await ensureSupportTicketsTable();
        const referenciaID = req.user?.ReferenciaID;
        const { message, context, channel = "web" } = req.body;
        const ticketId = uuidv4();

        await pool.query(
            `INSERT INTO SupportTickets (id, referencia_id, context, channel, message, status)
             VALUES (?, ?, ?, ?, ?, 'OPEN')`,
            [ticketId, referenciaID || null, context, channel, message.trim()]
        );

        const { reply, confidence } = await analyzeMessage(message.trim(), context);
        const rule = canAiAnswer(confidence, message.trim(), context);

        if (rule.allowed && reply) {
            await pool.query(
                `UPDATE SupportTickets SET ai_response = ?, ai_confidence = ?, status = 'AI_ANSWERED' WHERE id = ?`,
                [reply, confidence, ticketId]
            );
            logSupportAiDecision(ticketId, true, confidence);
            return res.status(200).json({ message: reply });
        }

        logSupportAiDecision(ticketId, false, confidence, rule.reason);
        logSupportEscalation(ticketId, rule.reason || "escalated");

        await pool.query(
            `UPDATE SupportTickets SET status = 'ESCALATED' WHERE id = ?`,
            [ticketId]
        );

        if (referenciaID) {
            await legacyCreateTicket({ referenciaID, message: message.trim() });
        }
        setImmediate(() => {
            notifySupportTeam(ticketId, message).catch(() => {});
        });

        return res.status(200).json({ message: FALLBACK_MESSAGE });
    } catch (err) {
        console.error("[SUPPORT-TICKET] Erro:", err);
        return res.status(500).json({ error: "Erro ao processar pedido de suporte." });
    }
}

export { VALID_CONTEXTS };
