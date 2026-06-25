const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { resolveSuggestionsPanelChannel } = require('../../utils/suggestionPublic');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'setup-sugestao',
    aliases: ['config-sugestao', 'setup-sugerir', 'config-sugerir'],
    description: 'Set up the feature suggestion panel. (Administrators only)',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!message.guild) {
                return message.reply('**This command can only be used in a server.**');
            }

            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission denied')
                    .setDescription('Only administrators can configure the suggestions panel.')
                    .setColor(0xff0000)
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }

            let targetChannel = await resolveSuggestionsPanelChannel(message.guild, client);

            if (!targetChannel && args.length > 0) {
                const channelId = String(args[0]).replace(/[<#>]/g, '');
                const mentionedChannel = message.guild.channels.cache.get(channelId);
                if (mentionedChannel?.type === ChannelType.GuildText) {
                    targetChannel = mentionedChannel;
                }
            }

            if (!targetChannel) {
                targetChannel = message.channel;
            }

            const publicChannelId = process.env.DISCORD_SUGGESTIONS_PUBLIC_CHANNEL_ID;
            const publicNote = publicChannelId
                ? `\n\nPublic votes are posted in <#${publicChannelId}> — keep this channel for the panel only.`
                : '\n\nTip: set `DISCORD_SUGGESTIONS_PANEL_CHANNEL_ID` (panel) and `DISCORD_SUGGESTIONS_PUBLIC_CHANNEL_ID` (votes) to separate channels.';

            const sugestaoPanelEmbed = new EmbedBuilder()
                .setTitle('Suggest a Feature')
                .setDescription(
                    '**Have an idea to improve PromoPing?**\n\n' +
                    'Click the button below to open the suggestion form.\n\n' +
                    '**What you can suggest:**\n' +
                    '• New website features\n' +
                    '• Discord bot improvements\n' +
                    '• Additional tools and integrations\n' +
                    '• UI/UX enhancements\n\n' +
                    '**Your suggestion goes to the admin panel and is posted for community voting.**' +
                    publicNote
                )
                .setColor(0x3B82F6)
                .setTimestamp()
                .setFooter({ text: 'PromoPing • Suggestions • Pinned panel' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('abrir_formulario_sugestao')
                    .setLabel('Suggest Feature')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💡')
            );

            const panelMessage = await targetChannel.send({
                embeds: [sugestaoPanelEmbed],
                components: [row],
            });

            await panelMessage.pin().catch(() => {});

            const confirmEmbed = new EmbedBuilder()
                .setTitle('Suggestions panel configured')
                .setDescription(
                    `Panel sent and **pinned** in ${targetChannel}.\n` +
                    'Community suggestions will appear in the public suggestions channel (not here).'
                )
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });
        } catch (error) {
            console.error('[DISCORD] Error in setup-sugestao command:', error);
            await message.reply('**Internal error.** Please try again in a few minutes.');
        }
    },
};
