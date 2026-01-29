import { pool } from "../database/db.js";
import { sendAutoResponse, shouldEscalateToHuman, escalateToHuman } from "./autoSupport.js";

/**
 * Wraps existing legacy support: creates thread in supportmessages and triggers
 * autoSupport (sendAutoResponse / escalateToHuman). Does not change internal logic.
 *
 * @param {Object} data
 * @param {string} data.referenciaID
 * @param {string} data.message
 * @returns {Promise<{ threadId: number }>}
 */
export async function createTicket(data) {
    const { referenciaID, message } = data;
    const [result] = await pool.query(
        "INSERT INTO supportmessages (ReferenciaID, message, senderType) VALUES (?, ?, 'user')",
        [referenciaID, message.trim()]
    );
    const newMessageId = result.insertId;
    await pool.query(
        "UPDATE supportmessages SET threadId = ? WHERE id = ?",
        [newMessageId, newMessageId]
    );

    setImmediate(async () => {
        try {
            const shouldEscalate = await shouldEscalateToHuman(newMessageId);
            if (shouldEscalate) {
                await escalateToHuman(newMessageId, referenciaID);
            } else {
                await sendAutoResponse(newMessageId, message.trim(), referenciaID);
            }
        } catch (err) {
            console.error("[LEGACY-SUPPORT] Erro ao processar resposta automática:", err);
        }
    });

    return { threadId: newMessageId };
}
