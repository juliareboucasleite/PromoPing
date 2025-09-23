// backend/bots/telegram.js
import axios from "axios";

async function sendTelegram(chatId, mensagem) {
    try {
        const response = await axios.post(
            `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: mensagem
            }
        );
        console.log("📨 Telegram enviado:", response.data);
        return response.data;
    } catch (err) {
        console.error("❌ Erro ao enviar Telegram:", err);
        throw err;
    }
}

export { sendTelegram };