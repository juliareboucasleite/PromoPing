const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'lock',
    aliases: ['trancar', 'bloquear'],
    description: 'Tranca o chat, impedindo que membros enviem mensagens.',
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

            // Verificar se o canal já está trancado
            const currentPermissions = channel.permissionOverwrites.cache.get(everyoneRole.id);
            const isLocked = currentPermissions?.deny.has(PermissionFlagsBits.SendMessages);

            if (isLocked) {
                return await message.reply('🔒 Este canal já está trancado!');
            }

            // Trancar o canal - negar permissão de enviar mensagens para @everyone
            await channel.permissionOverwrites.edit(everyoneRole, {
                SendMessages: false
            });

            await message.reply('🔒 **Canal trancado!** Os membros não podem mais enviar mensagens aqui.\nUse `!unlock` para destrancar.');

        } catch (error) {
            console.error('[DISCORD] Erro no comando lock:', error);
            return await message.reply('❌ Ocorreu um erro ao trancar o canal. Tente novamente.');
        }
    }
};

