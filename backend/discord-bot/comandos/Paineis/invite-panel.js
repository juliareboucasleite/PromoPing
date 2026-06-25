const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'invite-panel',
    aliases: ['painel-convite', 'setup-invite', 'convite-panel'],
    description: 'Set up the server invite panel. (Administrators only)',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!message.guild) {
                return message.reply('This command can only be used in a server.');
            }

            if (!botInstance.isAdmin(message.member)) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission denied')
                    .setDescription('Only administrators can configure the invite panel.')
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
                    return message.reply('Invalid channel. Mention a text channel or run the command in the desired channel.\n**Example:** `!invite-panel #welcome`');
                }
            }

            const inviteUrl = 'https://discord.gg/VbukwrCqYU';
            const siteUrl = process.env.SITE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt';
            const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;

            const invitePanelEmbed = new EmbedBuilder()
                .setTitle('Join PromoPing')
                .setDescription(
                    '**Welcome to PromoPing** — real-time price tracking for your favorite products.\n\n' +
                    '**What we offer:**\n' +
                    '• **Website** — full product management dashboard\n' +
                    '• **Discord Bot** — automatic price drop alerts\n' +
                    '• **Support** — dedicated help team\n' +
                    '• **Community** — share deals and reviews\n\n' +
                    '**Join our Discord and never miss a deal again.**'
                )
                .setColor(0xffa500)
                .addFields(
                    { name: 'Website', value: `[Visit site](${siteUrl})`, inline: true },
                    { name: 'Bot', value: `[Add to server](${botInviteUrl})`, inline: true },
                    { name: 'Support', value: 'Use `!support` to open a ticket', inline: true }
                )
                .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: 'PromoPing • Join us' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setLabel('Join Server').setStyle(ButtonStyle.Link).setURL(inviteUrl),
                    new ButtonBuilder().setLabel('Website').setStyle(ButtonStyle.Link).setURL(siteUrl),
                    new ButtonBuilder().setLabel('Add Bot').setStyle(ButtonStyle.Link).setURL(botInviteUrl)
                );

            await targetChannel.send({ embeds: [invitePanelEmbed], components: [row] });

            const confirmEmbed = new EmbedBuilder()
                .setTitle('Invite panel configured')
                .setDescription(`The invite panel was sent to ${targetChannel}`)
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [confirmEmbed] });
        } catch (error) {
            console.error('[DISCORD] Error in invite-panel command:', error);
            await message.reply('Internal error. Please try again in a few minutes.');
        }
    },
};
