const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'community-panel',
    aliases: ['painel-community', 'setup-community', 'community-resources'],
    description: 'Set up the community resources panel. (Administrators only)',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!message.guild) {
                return message.reply('This command can only be used in a server.');
            }

            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission denied')
                    .setDescription('Only administrators can configure the community panel.')
                    .setColor(0xff0000)
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            let targetChannel = message.channel;

            if (args.length > 0) {
                const channelId = String(args[0]).replace(/[<#>]/g, '');
                const mentionedChannel = message.guild.channels.cache.get(channelId);
                if (mentionedChannel && mentionedChannel.type === ChannelType.GuildText) {
                    targetChannel = mentionedChannel;
                } else {
                    return message.reply('Invalid channel. Mention a text channel or run the command in the desired channel.\n**Example:** `!community-panel #community`');
                }
            }

            const githubDiscussionsUrl = 'https://github.com/juliareboucasleite/PromoPing/discussions';
            const githubRepoUrl = 'https://github.com/juliareboucasleite/PromoPing';
            const githubBotSuporterUrl = 'https://github.com/juliareboucasleite/PromoPingBotSuporter';
            const siteUrl = process.env.SITE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt';

            const communityPanelEmbed = new EmbedBuilder()
                .setTitle('Community Resources — PromoPing')
                .setDescription(
                    '**Welcome to the PromoPing community hub.**\n\n' +
                    'Find useful links to participate, contribute, and stay up to date.\n\n' +
                    '**What you can do:**\n' +
                    '• **Discuss** — share ideas and ask questions\n' +
                    '• **Report bugs** — help us improve the platform\n' +
                    '• **Suggest features** — propose new ideas\n' +
                    '• **Contribute** — collaborate on GitHub\n\n' +
                    '**Join the conversation and be part of our community.**'
                )
                .setColor(0x24292e)
                .addFields(
                    { name: 'GitHub Discussions', value: `[Join discussions](${githubDiscussionsUrl})`, inline: false },
                    { name: 'GitHub Repository', value: `[View source code](${githubRepoUrl})`, inline: true },
                    { name: 'Support Bot', value: `[GitHub Bot Supporter](${githubBotSuporterUrl})`, inline: true },
                    { name: 'Website', value: `[Visit promoping.pt](${siteUrl})`, inline: true },
                    { name: 'Categories', value: 'Announcements • Bug Reports • Suggestions • General • Q&A', inline: false }
                )
                .setThumbnail('https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png')
                .setTimestamp()
                .setFooter({ text: 'PromoPing • Community' });

            const row1 = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setLabel('GitHub Discussions').setStyle(ButtonStyle.Link).setURL(githubDiscussionsUrl),
                    new ButtonBuilder().setLabel('Repository').setStyle(ButtonStyle.Link).setURL(githubRepoUrl),
                    new ButtonBuilder().setLabel('Support Bot').setStyle(ButtonStyle.Link).setURL(githubBotSuporterUrl),
                    new ButtonBuilder().setLabel('Website').setStyle(ButtonStyle.Link).setURL(siteUrl)
                );

            await targetChannel.send({ embeds: [communityPanelEmbed], components: [row1] });

            const confirmEmbed = new EmbedBuilder()
                .setTitle('Community panel configured')
                .setDescription(`The community panel was sent to ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });
        } catch (error) {
            console.error('[DISCORD] Error in community-panel command:', error);
            await message.reply('Internal error. Please try again in a few minutes.');
        }
    },
};
