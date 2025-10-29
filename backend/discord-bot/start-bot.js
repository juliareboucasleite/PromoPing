const PromoPingBot = require('./bot');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('Iniciando PromoPing Discord Bot...');
console.log('=====================================');

// Verificar configurações
console.log('Verificando configurações...');
console.log(`Token configurado: ${process.env.DISCORD_BOT_TOKEN ? 'Sim' : 'Não'}`);
console.log(`Client ID: ${process.env.DISCORD_CLIENT_ID || 'Não configurado'}`);
console.log(`Guild ID: ${process.env.DISCORD_GUILD_ID || 'Não configurado'}`);

if (!process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN === 'SEU_TOKEN_AQUI') {
    console.error('DISCORD_BOT_TOKEN não configurado!');
    console.log('Configure o token no arquivo .env da raiz do projeto');
    process.exit(1);
}

// Criar e iniciar o bot
const bot = new PromoPingBot();

// Tratamento de erros
process.on('unhandledRejection', (reason, promise) => {
    console.error('Erro não tratado:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Exceção não capturada:', error);
    process.exit(1);
});

// Iniciar o bot
async function startBot() {
    try {
        console.log('Conectando ao Discord...');
        await bot.connect();
        console.log('Bot conectado com sucesso!');
        console.log('O bot está online no Discord');
        console.log('Comandos disponíveis: !ping, !status, !iniciar, !parar, !ajuda');
        console.log('Use !ajuda para ver todos os comandos disponíveis');
    } catch (error) {
        console.error('Erro ao conectar:', error.message);
        console.log('Verifique se o token está correto e o bot foi convidado para o servidor');
        process.exit(1);
    }
}

// Tratamento de sinais
process.on('SIGINT', async () => {
    console.log('\nDesconectando bot...');
    await bot.disconnect();
    console.log('Bot desconectado');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nDesconectando bot...');
    await bot.disconnect();
    console.log('Bot desconectado');
    process.exit(0);
});

// Iniciar
startBot();
