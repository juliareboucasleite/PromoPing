module.exports = {
    name: 'ping',
    aliases: ['pong', 'test'],
    description: 'Verifica se o bot está ativo e responde com latência.',
    execute: async (client, message, args, botInstance) => {
        const sent = await message.reply('🏓 Pong! Calculando latência...');
        const latency = sent.createdTimestamp - message.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        
        await sent.edit(`🏓 **Pong!**\n📡 Latência: \`${latency}ms\`\n🤖 API: \`${apiLatency}ms\`\n✅ Bot online e operacional!`);
    }
};
