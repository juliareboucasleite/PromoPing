module.exports = {
    name: 'ping',
    aliases: ['pong', 'test'],
    description: 'Verifica se o bot está ativo e responde com latência.',
    execute: async (client, message, args, botInstance) => {
        const sent = await message.reply('Pong! Calculando latência...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        await sent.edit(`**Pong!**\nLatência: \`${latency}ms\`\nAPI: \`${apiLatency}ms\`\nBot online e operacional!`);
    }
};
