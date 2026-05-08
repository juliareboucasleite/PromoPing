/**
 * Cria tickets no Discord (categoria "Tickets" + canal por ticket) e envia mensagens ao vivo.
 * Usa o servidor interno do bot (porta 3001). Não precisa de ID de canal no .env.
 */

const INTERNAL_BOT_URL = process.env.INTERNAL_BOT_URL || "http://127.0.0.1:3001";

/**
 * Cria a categoria "Tickets" (se não existir) e um canal por ticket no Discord.
 * Faz retry se o bot ainda não estiver pronto (503) ou conexão recusada.
 */
export async function createTicketChannel(threadId, message, userName, userEmail, options = {}) {
    const maxRetries = 5;
    const retryDelayMs = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(`${INTERNAL_BOT_URL}/internal/create-support-ticket`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    threadId,
                    message: (message || "").trim(),
                    userName: (userName || "").trim() || undefined,
                    userEmail: (userEmail || "").trim() || undefined,
                    transcript: typeof options.transcript === "string" ? options.transcript : undefined,
                    escalationReason: typeof options.escalationReason === "string" ? options.escalationReason : undefined,
                }),
            });
            const text = await res.text();
            if (res.ok) {
                const data = JSON.parse(text);
                const channelId = data.channelId || null;
                if (channelId) {
                    console.log(" [SUPPORT-DISCORD] Ticket criado no Discord, channelId:", channelId);
                }
                return channelId;
            }
            if (res.status === 503 && attempt < maxRetries) {
                console.warn(" [SUPPORT-DISCORD] Bot ainda não pronto (tentativa " + attempt + "/" + maxRetries + "), a aguardar " + retryDelayMs / 1000 + "s...");
                await new Promise((r) => setTimeout(r, retryDelayMs));
                continue;
            }
            console.warn(" [SUPPORT-DISCORD] Falha ao criar ticket:", res.status, text);
            return null;
        } catch (err) {
            if (attempt < maxRetries && (err.cause?.code === "ECONNREFUSED" || err.message?.includes("fetch"))) {
                console.warn(" [SUPPORT-DISCORD] Sem ligação ao bot (tentativa " + attempt + "/" + maxRetries + "), a aguardar " + retryDelayMs / 1000 + "s...", err.message);
                await new Promise((r) => setTimeout(r, retryDelayMs));
                continue;
            }
            console.warn(" [SUPPORT-DISCORD] Erro ao criar ticket:", err.message);
            return null;
        }
    }
    return null;
}

/**
 * Envia uma mensagem ao vivo para o canal do ticket (criado automaticamente).
 * @param {string} channelId - ID do canal Discord do ticket
 * @param {string} messageText - Texto da mensagem
 * @param {string} senderType - 'user' ou 'support'
 */
export async function sendMessageToChannel(channelId, messageText, senderType) {
    if (!channelId) return;
    try {
        const who = senderType === "support" ? "Suporte" : "Utilizador";
        const short = (messageText || "").trim().substring(0, 500);
        const embed = {
            title: who,
            description: short || "(sem texto)",
            color: senderType === "support" ? 0x3498db : 0x95a5a6,
            timestamp: new Date().toISOString(),
            footer: { text: "PromoPing Suporte • Ao vivo" },
        };
        const res = await fetch(`${INTERNAL_BOT_URL}/internal/send-message`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId, embed }),
        });
        if (!res.ok) {
            console.warn(" [SUPPORT-DISCORD] Falha ao enviar mensagem ao vivo:", await res.text());
        }
    } catch (err) {
        console.warn(" [SUPPORT-DISCORD] Erro ao enviar ao vivo:", err.message);
    }
}
