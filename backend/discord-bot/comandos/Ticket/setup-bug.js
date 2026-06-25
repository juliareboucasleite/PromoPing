const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });



module.exports = {

    name: 'setup-bug',

    aliases: ['config-bug', 'setup-reportar', 'config-reportar'],

    description: 'Set up the bug report panel. (Administrators only)',

    execute: async (client, message, args, botInstance) => {

        try {

            if (!message.guild) {

                return message.reply('**This command can only be used in a server.**');

            }



            if (!botInstance.isAdmin(message.member)) {

                const embed = new EmbedBuilder()

                    .setTitle('Permission denied')

                    .setDescription('Only administrators can configure the bug report panel.')

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

                    return message.reply('**Invalid channel.** Mention a text channel or run the command in the desired channel.\n**Example:** `!setup-bug #bug-reports`');

                }

            }



            const bugPanelEmbed = new EmbedBuilder()

                .setTitle('Report a Bug')

                .setDescription(

                    '**Found a bug or issue?**\n\n' +

                    'Click the button below to open the report form.\n\n' +

                    '**What you can report:**\n' +

                    '• System bugs and errors\n' +

                    '• Functionality issues\n' +

                    '• Improvement suggestions\n\n' +

                    '**Your report goes directly to the admin team.**'

                )

                .setColor(0xFF6B6B)

                .setTimestamp()

                .setFooter({ text: 'PromoPing • Bug Reports' });



            const row = new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId('abrir_formulario_bug')

                        .setLabel('Report Bug')

                        .setStyle(ButtonStyle.Secondary)

                        .setEmoji('🐛')

                );



            await targetChannel.send({ embeds: [bugPanelEmbed], components: [row] });



            const confirmEmbed = new EmbedBuilder()

                .setTitle('Bug report panel configured')

                .setDescription(`The bug report panel was sent to ${targetChannel}`)

                .setColor(0x00ff00)

                .setTimestamp();



            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {

            console.error('[DISCORD] Error in setup-bug command:', error);

            await message.reply('**Internal error.** Please try again in a few minutes.');

        }

    },

};

