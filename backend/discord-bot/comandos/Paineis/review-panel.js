const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');



module.exports = {

    name: 'review-panel',

    aliases: ['painel-review', 'setup-review'],

    description: 'Set up the reviews panel in a channel. (Administrators only)',

    execute: async (client, message, args, botInstance) => {

        try {

            if (!message.guild) {

                return message.reply('This command can only be used in a server.');

            }



            if (!botInstance.isAdmin(message.member)) {

                const embed = new EmbedBuilder()

                    .setTitle('Permission denied')

                    .setDescription('Only administrators can configure the reviews panel.')

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

                    return message.reply('Invalid channel. Mention a text channel or run the command in the desired channel.\n**Example:** `!review-panel #reviews`');

                }

            }



            const reviewPanelEmbed = new EmbedBuilder()

                .setTitle('Reviews — PromoPing')

                .setDescription(

                    '**Share your experience with PromoPing.**\n\n' +

                    'Rate the **Website**, **Discord Bot**, or **Support** and help us improve.\n\n' +

                    '**How it works:**\n' +

                    '1. Click the button below\n' +

                    '2. Choose what you want to review\n' +

                    '3. Decide whether to stay anonymous\n' +

                    '4. Submit your feedback\n\n' +

                    '**You can include a 1–5 star rating in your review.**'

                )

                .setColor(0xffa500)

                .addFields({

                    name: 'Commands',

                    value: '`!review` — start a review\n`/review` — slash command',

                    inline: false,

                })

                .setTimestamp()

                .setFooter({ text: 'PromoPing • Reviews' });



            const row = new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId('iniciar_review_promoping')

                        .setLabel('Leave a Review')

                        .setStyle(ButtonStyle.Secondary)

                );



            await targetChannel.send({

                embeds: [reviewPanelEmbed],

                components: [row],

            });



            const confirmEmbed = new EmbedBuilder()

                .setTitle('Reviews panel configured')

                .setDescription(`The reviews panel was sent to ${targetChannel}`)

                .setColor(0x00ff00)

                .setTimestamp();



            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {

            console.error('[DISCORD] Error in review-panel command:', error);

            await message.reply('Internal error. Please try again in a few minutes.');

        }

    },

};

