const { EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'community-panel',
    aliases: ['painel-community', 'setup-community', 'community-resources'],
    description: 'Configura o painel de recursos da comunidade (GitHub Discussions). Escolha o canal onde o painel aparecerá. (Apenas administradores)',
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
                    .setDescription('Apenas administradores podem configurar o painel de recursos da comunidade!')
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
                    return message.reply('Canal inválido! Mencione um canal de texto válido ou use o comando no canal desejado.\n**Exemplo:** `!community-panel #community-resources`');
                }
            }

            // URLs
            const githubDiscussionsUrl = 'https://github.com/juliareboucasleite/PromoPing/discussions';
            const githubRepoUrl = 'https://github.com/juliareboucasleite/PromoPing';
            const githubBotSuporterUrl = 'https://github.com/juliareboucasleite/PromoPingBotSuporter';
            const siteUrl = process.env.SITE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt';

            // Criar embed do painel de recursos da comunidade
            const communityPanelEmbed = new EmbedBuilder()
                .setTitle('Recursos da Comunidade - PromoPing')
                .setDescription(
                    '**Bem-vindo ao canal de recursos da comunidade!** 🎉\n\n' +
                    'Aqui encontrará links úteis para participar ativamente na comunidade PromoPing.\n\n' +
                    '**O que pode fazer:**\n' +
                    '• **Discutir** - Partilhe ideias, faça perguntas e participe em discussões\n' +
                    '• **Reportar Bugs** - Ajude-nos a melhorar reportando problemas\n' +
                    '• **Sugerir Funcionalidades** - Partilhe suas ideias para novas funcionalidades\n' +
                    '• **Colaborar** - Contribua para o projeto no GitHub\n\n' +
                    '**Junte-se às discussões e faça parte da nossa comunidade!**'
                )
                .setColor(0x24292e)
                .addFields(
                    {
                        name: 'GitHub Discussions',
                        value: `[Participar nas Discussões](${githubDiscussionsUrl})`,
                        inline: false
                    },
                    {
                        name: 'Repositório GitHub',
                        value: `[Ver Código Fonte](${githubRepoUrl})`,
                        inline: true
                    },
                    {
                        name: 'Bot de Suporte',
                        value: `[GitHub Bot Suporter](${githubBotSuporterUrl})`,
                        inline: true
                    },
                    {
                        name: 'Site',
                        value: `[Acessar Site](${siteUrl})`,
                        inline: true
                    },
                    {
                        name: 'Categorias Disponíveis',
                        value: 'Anúncios • Reportar Bugs • Sugestões • Geral • Q&A',
                        inline: false
                    }
                )
                .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
                .setTimestamp()
                .setFooter({ text: '©PromoPing • Todos os direitos reservados' });

            // Criar botões (máximo 5 por linha no Discord)
            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('GitHub Discussions')
                        .setStyle(ButtonStyle.Link)
                        .setURL(githubDiscussionsUrl),
                    new ButtonBuilder()
                        .setLabel('Repositório GitHub')
                        .setStyle(ButtonStyle.Link)
                        .setURL(githubRepoUrl),
                    new ButtonBuilder()
                        .setLabel('Bot Suporter')
                        .setStyle(ButtonStyle.Link)
                        .setURL(githubBotSuporterUrl),
                    new ButtonBuilder()
                        .setLabel('Acessar Site')
                        .setStyle(ButtonStyle.Link)
                        .setURL(siteUrl)
                );

            // Enviar mensagem no canal escolhido
            await targetChannel.send({
                embeds: [communityPanelEmbed],
                components: [row1]
            });

            // Confirmar configuração
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Painel de Recursos da Comunidade Configurado!')
                .setDescription(`O painel de recursos da comunidade foi enviado para ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando community-panel:', error);
            await message.reply('Erro interno! Tente novamente em alguns minutos.');
        }
    }
};

