const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });



module.exports = {

    name: 'ticket',

    aliases: ['setup-ticket', 'config-ticket'],

    description: 'Set up the support ticket panel in a channel. (Administrators only)',

    execute: async (client, message, args, botInstance) => {

        try {

            if (!message.guild) {

                return message.reply('**This command can only be used in a server.**');

            }



            if (!botInstance.isAdmin(message.member)) {

                const embed = new EmbedBuilder()

                    .setTitle('Permission denied')

                    .setDescription('Only administrators can configure the ticket system.')

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

                    return message.reply('**Invalid channel.** Mention a valid text channel or run this command in the desired channel.\n**Example:** `!ticket #support`');

                }

            }



            const supportEmbed = new EmbedBuilder()

                .setTitle('Support & Help')

                .setDescription(

                    '**Need assistance?** Click the button below to open a private support ticket.\n\n' +

                    'Our team will respond as quickly as possible.'

                )

                .setColor(0xed4245)

                .setTimestamp()

                .setFooter({ text: 'PromoPing • Support' });



            const row = new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId('abrir_ticket_promoping')

                        .setLabel('Open Ticket')

                        .setStyle(ButtonStyle.Secondary)

                        .setEmoji('🎫')

                );



            await targetChannel.send({

                embeds: [supportEmbed],

                components: [row],

            });



            const confirmEmbed = new EmbedBuilder()

                .setTitle('Ticket panel configured')

                .setDescription(`The support panel was sent to ${targetChannel}`)

                .setColor(0x00ff00)

                .setTimestamp();



            try {

                await message.reply({ embeds: [confirmEmbed] });

            } catch (err) {

                try {

                    if (message.channel?.send) {

                        await message.channel.send({ embeds: [confirmEmbed] }).catch(() => {});

                    }

                } catch (e) {

                    console.warn('[DISCORD] Failed to confirm ticket setup:', e.message || e);

                }

            }

        } catch (error) {

            console.error('[DISCORD] Error in ticket command:', error);

            await message.reply('**Internal error.** Please try again in a few minutes.');

        }

    },

};

