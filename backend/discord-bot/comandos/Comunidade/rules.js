const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');



module.exports = {

    name: 'regras',

    aliases: ['regras', 'rules', 'r'],

    description: 'Display PromoPing community rules.',

    execute: async (client, message, args, botInstance) => {

        const paginas = [

            {

                titulo: 'PromoPing Community Rules',

                conteudo: [

                    '1. **Respect everyone.** Harassment, hate speech, and discrimination are not tolerated.',

                    '2. **No spam.** Avoid repeated messages or unauthorized advertising.',

                    '3. **Use commands responsibly.** Command abuse may result in moderation action.',

                    '4. **Do not exploit bot vulnerabilities.** Report issues to the staff team.',

                    '5. **Do not share personal or sensitive information** in public channels.',

                    '6. **Follow the PromoPing Terms of Service** and Discord Community Guidelines.',

                    '7. **Questions or issues:** Open a support ticket with `!support` in bot DMs or in <#1442960813563449516>.',

                ].join('\n'),

            },

        ];



        const criarEmbed = (paginaIndex) => {

            const pagina = paginas[paginaIndex];

            return new EmbedBuilder()

                .setTitle(pagina.titulo)

                .setDescription(pagina.conteudo)

                .setColor(0xffa500)

                .setTimestamp()

                .setFooter({

                    text: `Page ${paginaIndex + 1} of ${paginas.length} • PromoPing`,

                    iconURL: process.env.PROMOPING_LOGO_URL || '',

                });

        };



        const row = new ActionRowBuilder().addComponents(

            new ButtonBuilder()

                .setCustomId('aceitar_regras_promoping')

                .setLabel('I Have Read and Agree')

                .setStyle(ButtonStyle.Secondary)

        );



        await message.channel.send({ embeds: [criarEmbed(0)], components: [row] });

    },

};

