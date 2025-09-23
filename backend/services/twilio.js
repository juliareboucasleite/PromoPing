// Verificar se as credenciais do Twilio estão configuradas
const isTwilioConfigured = process.env.TWILIO_ACCOUNT_SID && 
                          process.env.TWILIO_AUTH_TOKEN && 
                          process.env.TWILIO_ACCOUNT_SID.startsWith('AC');

let client = null;
if (isTwilioConfigured) {
    try {
        // Usar require em vez de import dinâmico para evitar problemas no Windows
        const twilio = require("twilio");
        client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    } catch (error) {
        console.log("⚠️ Erro ao inicializar Twilio:", error.message);
    }
}

// Enviar SMS
export function sendSMS(to, mensagem) {
    if (!client) {
        throw new Error('Twilio não configurado. Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN');
    }
    
    return client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER || "+15617655992", // número trial SMS
        to,
        body: mensagem
    });
}

// Enviar WhatsApp
export function sendWhatsApp(to, mensagem) {
    if (!client) {
        throw new Error('Twilio não configurado. Configure TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN');
    }
    
    return client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER || "whatsapp:+14155238886", // sandbox
        to: `whatsapp:${to}`,
        body: mensagem
    });
}

// Dispatcher genérico
export function sendTwilioNotification({ numero, mensagem, canal }) {
    if (canal === "sms") {
        return sendSMS(numero, mensagem);
    } else if (canal === "whatsapp") {
        return sendWhatsApp(numero, mensagem);
    } else {
        throw new Error("Canal inválido: use 'sms' ou 'whatsapp'");
    }
}