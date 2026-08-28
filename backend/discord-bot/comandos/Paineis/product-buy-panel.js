const {
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require('discord.js');
const { PRODUCT } = require('../../config/productConfig');

module.exports = {
    name: 'product-buy',
    aliases: ['buy-panel', 'setup-buy', 'painel-buy'],
    description: 'Set up the product buy/help panel in a channel. (Administrators only)',
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
                    return message.reply('Invalid channel.\n**Example:** `!product-buy #buy`');
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`Need help or want ${PRODUCT.name}?`)
                .setDescription(
                    `**${PRODUCT.name}** — ${PRODUCT.price}\n\n` +
                    'Open a ticket to get support or purchase the product.\n\n' +
                    '**When contacting us:**\n' +
                    '• Explain your issue clearly\n' +
                    '• Send screenshots or payment proof if needed\n' +
                    '• Avoid opening duplicate tickets\n\n' +
                    '**Purchase:** select *Buy / Obtain Product* — payment via:\n' +
                    `• [Revolut Checkout](${PRODUCT.paymentUrl})\n` +
                    `• [PayPal (EUR)](${PRODUCT.paypalUrlEur})\n` +
                    `• [PayPal (USD)](${PRODUCT.paypalUrlUsd})\n\n` +
                    '💜 We will assist you as quickly as possible.\n\n' +
                    '*Beware of scams — our team will never DM you first.*'
                )
                .setColor(0x9b59b6)
                .setTimestamp()
                .setFooter({ text: `${PRODUCT.name} • PromoPing` });

            if (PRODUCT.bannerUrl && PRODUCT.bannerUrl.startsWith('http') && !PRODUCT.bannerUrl.includes('...')) {
                embed.setImage(PRODUCT.bannerUrl);
            }

            const select = new StringSelectMenuBuilder()
                .setCustomId('product_buy_select')
                .setPlaceholder('Select an option...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Get Help')
                        .setDescription('Questions, issues, setup help, or general support')
                        .setValue('help')
                        .setEmoji('❓'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Buy / Obtain Product')
                        .setDescription(`Purchase or obtain ${PRODUCT.name} (${PRODUCT.price})`)
                        .setValue('purchase')
                        .setEmoji('🛒')
                );

            await targetChannel.send({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(select)],
            });

            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setTitle('Buy panel configured')
                        .setDescription(`Panel sent to ${targetChannel}`)
                        .setColor(0x57f287)
                        .setTimestamp(),
                ],
            });
        } catch (error) {
            console.error('[DISCORD] product-buy panel error:', error);
            await message.reply('Internal error. Please try again.');
        }
    },
};
