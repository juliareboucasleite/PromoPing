import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Iniciando PromoPing Discord Bot...');
console.log('=====================================');

// Caminho para o bot (já estamos em backend/discord-bot)
const botPath = __dirname;

// Iniciar o bot
const bot = spawn('node', ['start-bot.js'], {
    cwd: botPath,
    stdio: 'inherit'
});

bot.on('error', (error) => {
    console.error('Erro ao iniciar bot:', error);
});

bot.on('close', (code) => {
    console.log(`Bot encerrado com código: ${code}`);
});

// Tratamento de sinais
process.on('SIGINT', () => {
    console.log('\nParando bot...');
    bot.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nParando bot...');
    bot.kill('SIGTERM');
    process.exit(0);
});

console.log('Bot iniciado! Verifique o Discord.');
console.log('Comandos: !ping, !status, !iniciar, !parar');
