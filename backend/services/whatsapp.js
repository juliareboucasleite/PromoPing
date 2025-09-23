import { sendWhatsApp } from "./twilio.js";

export function initWhatsAppBot() {
    // Teste inicial ao subir o servidor
    sendWhatsApp("+351933992199", "✅ PromoPing ativo. Notificações vão aparecer aqui.")
        .then(msg => console.log("Mensagem WhatsApp enviada:", msg.sid))
        .catch(err => console.error("Erro WhatsApp:", err));
}