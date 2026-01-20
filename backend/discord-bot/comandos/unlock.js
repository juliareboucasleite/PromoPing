const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'unlock',
    aliases: ['destrancar', 'desbloquear'],
    description: 'Destranca o chat, permitindo que membros enviem mensagens novamente.',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar permissões de administrador ou gerenciar canais
            if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels) && 
                !botInstance.isAdmin(message.member)) {
                return await message.reply('❌ Você precisa de permissão para gerenciar canais para usar este comando.');
            }

            const channel = message.channel;

            // Verificar se o bot tem permissão para gerenciar canais
            if (!channel.permissionsFor(client.user).has(PermissionFlagsBits.ManageChannels)) {
                return await message.reply('❌ Eu não tenho permissão para gerenciar este canal.');
            }

            // Obter o role @everyone
            const everyoneRole = message.guild.roles.everyone;

            // Verificar se o canal está trancado
            const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
            const isLocked = currentPermissions?.deny.has(PermissionFlagsBits.SendMessages);

            if (!isLocked) {
                return await message.reply('🔓 Este canal já está destrancado!');
            }

            // Destrancar o canal - remover a negação de permissão de enviar mensagens para @everyone
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: null // null remove a permissão específica, voltando ao padrão
            });

            await message.reply('🔓 **Canal destrancado!** Os membros podem enviar mensagens novamente.');

        } catch (error) {
            console.error('[DISCORD] Erro no comando unlock:', error);
            return await message.reply('❌ Ocorreu um erro ao destrancar o canal. Tente novamente.');
        }
    }
};

