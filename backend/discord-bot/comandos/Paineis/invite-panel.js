const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'invite-panel',
    aliases: ['painel-convite', 'setup-invite', 'convite-panel'],
    description: 'Configura o painel de convite do servidor. Escolha o canal onde o painel aparecerá. (Apenas administradores)',
    execute: async (client, message, args, botInstance) => {
        try {
            // Verificar se o comando foi usado em um servidor
            if (!message.guild) {
                return message.reply('Este comando só pode ser usado em um servidor!');
            }

            // Verificar se o usuário é administrador
            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Sem Permissão')
                    .setDescription('Apenas administradores podem configurar o painel de convite!')
                    .setColor(0xff0000)
                    .setTimestamp();
                
                return message.reply({ embeds: [embed] });
            }

            // Verificar se foi mencionado um canal
            let targetChannel = message.channel; // Canal padrão é o atual

            if (args.length > 0) {
                // Tentar encontrar o canal mencionado
                const channelMention = args[0];
                const channelId = channelMention.replace(/[<#>]/g, '');
                
                const mentionedChannel = message.guild.channels.cache.get(channelId);
                if (mentionedChannel && mentionedChannel.type === ChannelType.GuildText) {
                    targetChannel = mentionedChannel;
                } else {
                    return message.reply('Canal inválido! Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!invite-panel #bem-vindo`');
                }
            }

            // URL do convite do servidor
            const inviteUrl = 'https://discord.gg/VbukwrCqYU';
            const siteUrl = process.env.SITE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt';
            const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

            // Criar embed do painel de convite
            const invitePanelEmbed = new EmbedBuilder()
                .setTitle('PromoPing - Junte-se à Nossa Comunidade!')
                .setDescription(
                    '**Bem-vindo ao PromoPing!** 🎉\n\n' +
                    'Somos uma plataforma completa para monitorização de preços de produtos em tempo real.\n\n' +
                    '**O que oferecemos:**\n' +
                    '• **Site** - Interface web completa para gestão de produtos\n' +
                    '• **Bot Discord** - Notificações automáticas de mudanças de preço\n' +
                    '• **Suporte** - Equipa dedicada para ajudar\n' +
                    '• **Comunidade** - Partilha experiências e avaliações\n\n' +
                    '**Junte-se ao nosso servidor Discord e comece a monitorizar os melhores preços!**'
                )
                .setColor(0xffa500)
                .addFields(
                    {
                        name: 'Site',
                        value: `[Acessar Site](${siteUrl})`,
                        inline: true
                    },
                    {
                        name: 'Bot',
                        value: `[Adicionar Bot](${botInviteUrl})`,
                        inline: true
                    },
                    {
                        name: 'Suporte',
                        value: 'Use `!suporte` para criar um ticket',
                        inline: true
                    }
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botões
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Entrar no Servidor')
                        .setStyle(ButtonStyle.Link)
                        .setURL(inviteUrl),
                    new ButtonBuilder()
                        .setLabel('Acessar Site')
                        .setStyle(ButtonStyle.Link)
                        .setURL(siteUrl),
                    new ButtonBuilder()
                        .setLabel('Adicionar Bot')
                        .setStyle(ButtonStyle.Link)
                        .setURL(botInviteUrl)
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [invitePanelEmbed],
                components: [row]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Painel de Convite Configurado!')
                .setDescription(`O painel de convite foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando invite-panel:', error);
            await message.reply('Erro interno! Tente novamente em alguns minutos.');
        }
    }
};

