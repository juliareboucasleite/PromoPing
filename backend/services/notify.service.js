import { sendEmail } from "./notify.js";

/**
 * Notifies support team (e.g. admin email) when a ticket is escalated.
 * Uses existing nodemailer via notify.sendEmail. Can be mocked in tests.
 *
 * @param {string} ticketId
 * @param {string} messagePreview
 * @returns {Promise<void>}
 */
export async function notifySupportTeam(ticketId, messagePreview) {
    const to = process.env.SUPPORT_EMAIL || process.env.EMAIL_USER;
    if (!to) return;
    try {
        await sendEmail(
            to,
            `[PromoPing] Ticket escalado: ${ticketId}`,
            `Um ticket foi escalado para suporte humano.\n\nTicket ID: ${ticketId}\nMensagem: ${(messagePreview || "").slice(0, 500)}`
        );
    } catch (err) {
        console.error("[NOTIFY-SERVICE] Erro ao notificar suporte:", err.message);
    }
}
