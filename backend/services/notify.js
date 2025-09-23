import { sendDiscord } from "./discord.js";
import { sendTelegram } from "./telegram.js";

// Função temporária para Twilio (será implementada quando configurado)
const sendTwilioNotification = null;

async function sendNotification({ numero, mensagem, canal }) {
    if (canal === "discord") {
        await sendDiscord(numero, mensagem);
        return { status: "ok", canal, mensagem };
    }

    if (canal === "sms" || canal === "whatsapp") {
        if (!sendTwilioNotification) {
            throw new Error("Twilio não configurado. Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN");
        }
        return await sendTwilioNotification({ numero, mensagem, canal });
    }

    if (canal === "telegram") {
        return await sendTelegram(numero, mensagem);
    }

    throw new Error(`❌ Canal inválido: ${canal}`);
}

export { sendNotification };