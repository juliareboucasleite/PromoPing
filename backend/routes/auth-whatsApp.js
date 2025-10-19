// npm install whatsapp-web.js
import { Client } from 'whatsapp-web.js';

const client = new Client();

client.on('qr', qr => {
    console.log('QR Code gerado. Escaneie com o WhatsApp:');
    console.log(qr);
});

client.on('ready', () => {
    console.log('Bot conectado ao WhatsApp!');
});

client.initialize();

// Função que pode ser chamada em qualquer rota
async function enviarWhatsApp(numero, mensagem) {
    try {
        // Verificar se o cliente está conectado
        if (client.getState() !== 'CONNECTED') {
            console.log('WhatsApp não está conectado. Estado:', client.getState());
            return { success: false, error: 'WhatsApp não conectado' };
        }

        // Limpar número (remover espaços, traços, etc.)
        const numeroLimpo = numero.replace(/[^\d]/g, '');
        const numeroCompleto = numeroLimpo + '@c.us';
        
        console.log(`Tentando enviar mensagem para: ${numeroCompleto}`);
        console.log(`Mensagem: ${mensagem}`);
        
        await client.sendMessage(numeroCompleto, mensagem);
        console.log(`Mensagem enviada com sucesso para ${numero}`);
        
        return { success: true, message: 'Mensagem enviada com sucesso' };
    } catch (err) {
        console.error('Erro ao enviar mensagem WhatsApp:', err);
        return { success: false, error: err.message };
    }
}

// Função para verificar status do WhatsApp
function getWhatsAppStatus() {
    return {
        state: client.getState(),
        connected: client.getState() === 'CONNECTED'
    };
}

export { enviarWhatsApp, getWhatsAppStatus };

