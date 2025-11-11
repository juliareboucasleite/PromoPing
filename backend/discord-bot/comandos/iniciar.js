module.exports = {
    name: 'iniciar',
    aliases: ['start', 'on', 'ativar'],
    description: 'Inicia o monitoramento automático de preços.',
    execute: async (client, message, args, botInstance) => {
        if (botInstance.isMonitoring) {
            await message.reply(' O monitoramento já está ativo!');
            return;
        }
        
        botInstance.isMonitoring = true;
        await message.reply('**Monitoramento iniciado!**\nO bot agora verificará mudanças de preços automaticamente.\nIntervalo: a cada ' + botInstance.checkInterval + ' minutos');
        
        console.log(`[DISCORD] Monitoramento iniciado por ${message.author.username}`);
    }
};
