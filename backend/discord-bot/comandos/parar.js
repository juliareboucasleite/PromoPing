module.exports = {
    name: 'parar',
    aliases: ['stop', 'off', 'desativar'],
    description: 'Para o monitoramento automático de preços.',
    execute: async (client, message, args, botInstance) => {
        if (!botInstance.isMonitoring) {
            await message.reply('⚠️ O monitoramento já está parado!');
            return;
        }
        
        botInstance.isMonitoring = false;
        await message.reply('🛑 **Monitoramento parado!**\n📊 O bot não verificará mais mudanças de preços automaticamente.\n💡 Use `!iniciar` para reativar.');
        
        console.log(`[DISCORD] Monitoramento parado por ${message.author.username}`);
    }
};
