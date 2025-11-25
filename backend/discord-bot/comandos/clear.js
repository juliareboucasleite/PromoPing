const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'clear',
    aliases: ['purge', 'limpar', 'delete'],
    description: 'Limpa mensagens do chat. Pode limpar de 1 a 100 mensagens.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar permissões
            if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages) && 
                !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return await message.reply('❌ Você precisa de permissão para gerenciar mensagens para usar este comando.');
            }

            // Verificar se o bot tem permissão
            if (!message.channel.permissionsFor(client.user).has(PermissionFlagsBits.ManageMessages)) {
                return await message.reply('❌ Eu não tenho permissão para gerenciar mensagens neste canal.');
            }

            // Obter quantidade de mensagens para deletar
            const amount = parseInt(args[0]);

            if (!amount || isNaN(amount)) {
                return await message.reply('❌ Por favor, forneça um número válido de mensagens para deletar (1-100).\n**Uso:** `!clear <número>`');
            }

            if (amount < 1 || amount > 100) {
                return await message.reply('❌ Você pode deletar entre 1 e 100 mensagens por vez.');
            }

            // Deletar mensagens (incluindo a mensagem do comando)
            const messagesToDelete = amount + 1;

            try {
                // Buscar mensagens (máximo 100)
                const fetched = await message.channel.messages.fetch({ limit: Math.min(messagesToDelete, 100) });
                
                // Filtrar mensagens que não podem ser deletadas (mais de 14 dias)
                const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
                const deletable = fetched.filter(msg => msg.createdTimestamp > twoWeeksAgo);

                if (deletable.size === 0) {
                    return await message.reply('❌ Não há mensagens recentes o suficiente para deletar (máximo 14 dias).');
                }

                // Deletar mensagens
                const deleted = await message.channel.bulkDelete(deletable, true);

                // Enviar confirmação (que será deletada após 3 segundos)
                const confirmMsg = await message.channel.send(`✅ **${deleted.size}** mensagem(ns) deletada(s)!`);
                
                // Deletar mensagem de confirmação após 3 segundos
                setTimeout(() => {
                    confirmMsg.delete().catch(() => {});
                }, 3000);

            } catch (error) {
                console.error('[DISCORD] Erro ao deletar mensagens:', error);
                
                // Se for erro de mensagens antigas, tentar deletar individualmente
                if (error.code === 50034) {
                    return await message.reply('❌ Não é possível deletar mensagens com mais de 14 dias. Use um número menor ou delete manualmente.');
                }
                
                return await message.reply('❌ Ocorreu um erro ao deletar as mensagens. Tente novamente.');
            }

        } catch (error) {
            console.error('[DISCORD] Erro no comando clear:', error);
            return await message.reply('❌ Ocorreu um erro ao processar o comando. Tente novamente.');
        }
    }
};

