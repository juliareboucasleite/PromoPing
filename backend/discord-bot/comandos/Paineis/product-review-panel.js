const {
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const { PRODUCT } = require('../../config/productConfig');

module.exports = {
    name: 'product-review',
    aliases: ['review-product', 'setup-product-review', 'painel-review-produto'],
    description: 'Set up the product review panel (customers only). (Administrators only)',
    category: 'Paineis',
    execute: async (client, message, args, botInstance) => {
        try {
            if (!message.guild) {
                return message.reply('This command can only be used in a server.');
            }

            if (!botInstance.isAdmin(message.member)) {
                return message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('Permission denied')
                            .setDescription('Only administrators can configure this panel.')
                            .setColor(0xff0000)
                            .setTimestamp(),
                    ],
                });
            }

            let targetChannel = message.channel;
            if (args.length > 0) {
                const channelId = String(args[0]).replace(/[<#>]/g, '');
                const mentioned = message.guild.channels.cache.get(channelId);
                if (mentioned?.type === ChannelType.GuildText) {
                    targetChannel = mentioned;
                } else {
                    return message.reply('Invalid channel.\n**Example:** `!product-review #review`');
                }
            }

            const roleMentions = PRODUCT.reviewerRoleIds.map((id) => `<@&${id}>`).join(' ');

            const embed = new EmbedBuilder()
                .setTitle(`${PRODUCT.name} — Reviews`)
                .setDescription(
                    `Share your experience with **${PRODUCT.name}**.\n\n` +
                    'Tell us about installation, performance, or our support team.\n\n' +
                    '**Who can review?**\n' +
                    `Only customers with access to the product (${roleMentions}).\n\n` +
                    '**Tips:**\n' +
                    '• Include a rating from 1 to 5 stars in your review\n' +
                    '• Be honest and constructive\n' +
                    '• One review per customer'
                )
                .setColor(0x5865f2)
                .setTimestamp()
                .setFooter({ text: `${PRODUCT.name} • Reviews` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('product_review_start')
                    .setLabel('Leave a Review')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⭐')
            );

            await targetChannel.send({ embeds: [embed], components: [row] });

            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Product review panel configured')
                        .setDescription(`Panel sent to ${targetChannel}`)
                        .setColor(0x57f287)
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            console.error('[DISCORD] product-review panel error:', error);
            await message.reply('Internal error. Please try again.');
        }
    },
};
