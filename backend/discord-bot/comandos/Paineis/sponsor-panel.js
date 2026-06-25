const { EmbedBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });



const DEFAULT_LINKS = {

    patreon: 'https://www.patreon.com/PromoPing',

    paypal: 'https://www.paypal.com/donate/?hosted_button_id=SCCD4N72ZGXTW',

    instagram: 'https://www.instagram.com/rwboucas/',

    github: 'https://github.com/juliareboucasleite/PromoPing',

};



module.exports = {

    name: 'sponsor-panel',

    aliases: ['painel-sponsor', 'setup-sponsor', 'patrocinio-panel', 'painel-patrocinio'],

    description: 'Set up the sponsorship panel. (Administrators only)',

    category: 'Paineis',

    execute: async (client, message, args, botInstance) => {

        try {

            if (!message.guild) {

                return message.reply('This command can only be used in a server.');

            }



            if (!botInstance.isAdmin(message.member)) {

                const embed = new EmbedBuilder()

                    .setTitle('Permission denied')

                    .setDescription('Only administrators can configure the sponsor panel.')

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

                    return message.reply(

                        'Invalid channel. Mention a text channel or run the command in the desired channel.\n' +

                        '**Example:** `!sponsor-panel #sponsor`'

                    );

                }

            }



            const patreonUrl = process.env.PATREON_URL || process.env.SPONSOR_PATREON_URL || DEFAULT_LINKS.patreon;

            const paypalUrl = process.env.PAYPAL_DONATE_URL || process.env.SPONSOR_PAYPAL_URL || DEFAULT_LINKS.paypal;

            const instagramUrl = process.env.INSTAGRAM_URL || process.env.SPONSOR_INSTAGRAM_URL || DEFAULT_LINKS.instagram;

            const githubUrl = process.env.SPONSOR_GITHUB_URL || process.env.GITHUB_REPO_URL || DEFAULT_LINKS.github;

            const githubLabel = process.env.SPONSOR_GITHUB_LABEL || 'juliareboucasleite/PromoPing';



            const sponsorPanelEmbed = new EmbedBuilder()

                .setTitle('Support PromoPing')

                .setAuthor({ name: `Sponsor ${githubLabel}` })

                .setDescription('Help keep PromoPing running and support ongoing development.')

                .setColor(0xffa500)

                .addFields({

                    name: 'Official links',

                    value: [

                        `• [Patreon](${patreonUrl})`,

                        `• [PayPal](${paypalUrl})`,

                        `• [Instagram](${instagramUrl})`,

                        `• [GitHub](${githubUrl})`,

                    ].join('\n'),

                    inline: false,

                })

                .setTimestamp()

                .setFooter({ text: 'PromoPing • Thank you for your support' });



            const row = new ActionRowBuilder().addComponents(

                new ButtonBuilder().setLabel('Patreon').setStyle(ButtonStyle.Link).setURL(patreonUrl),

                new ButtonBuilder().setLabel('PayPal').setStyle(ButtonStyle.Link).setURL(paypalUrl),

                new ButtonBuilder().setLabel('Instagram').setStyle(ButtonStyle.Link).setURL(instagramUrl),

                new ButtonBuilder().setLabel('GitHub').setStyle(ButtonStyle.Link).setURL(githubUrl)

            );



            await targetChannel.send({ embeds: [sponsorPanelEmbed], components: [row] });



            const confirmEmbed = new EmbedBuilder()

                .setTitle('Sponsor panel configured')

                .setDescription(`The sponsor panel was sent to ${targetChannel}`)

                .setColor(0x00ff00)

                .setTimestamp();



            await message.reply({ embeds: [confirmEmbed] });

        } catch (error) {

            console.error('[DISCORD] Error in sponsor-panel command:', error);

            await message.reply('Internal error. Please try again in a few minutes.');

        }

    },

};

