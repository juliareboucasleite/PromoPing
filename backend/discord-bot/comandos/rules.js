const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'regras',
    aliases: ['regras', 'rules', 'r'],
    description: 'Mostra as regras do bot PromoPing.',
    execute: async (client, message, args, botInstance) => {
        const paginas = [
            {
                titulo:'Regras do PromoPing',
                conteudo: [
                    '1. **Respeite todos os usuários.** Não serão toleradas ofensas, racismo, ou preconceitos de qualquer natureza.',
                    '2. **Não faça spam.** Evite enviar mensagens repetidas ou anúncios não autorizados.',
                    '3. **Use os comandos corretamente.** Abuse dos comandos pode levar a ban.',
                    '4. **Não tente explorar falhas do bot.** Vulnerabilidades devem ser reportadas à equipe.',
                    '5. **Não compartilhe informações pessoais ou sensíveis no Discord.**',
                    '6. **Siga os Termos de Uso** do PromoPing e do Discord.',
                    '7. **Dúvidas ou problemas:** Abra um ticket pelo comando `!suporte` no privado do bot ou nesse canal <#1442960813563449516>.'
                ].join('\n')
                
            }
        ];

        const criarEmbed = (paginaIndex) => {
            const pagina = paginas[paginaIndex];
            return new EmbedBuilder()
                .setTitle(`${pagina.titulo}`)
                .setDescription(pagina.conteudo)
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({
                    text: `Página ${paginaIndex + 1} de ${paginas.length} • PromoPing`,
                    iconURL: process.env.PROMOPING_LOGO_URL || ''
                });
        };

        // Botão de verificação (✔️)
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('aceitar_regras_promoping')
                .setLabel('Eu Li e Concordo')
                .setStyle(ButtonStyle.Success)
        );

        // Enviar o embed + botão sem reply, apenas mandando no canal
        // O handler do botão está no bot.js (handleAceitarRegras)
        await message.channel.send({ embeds: [criarEmbed(0)], components: [row] });
    }
};
