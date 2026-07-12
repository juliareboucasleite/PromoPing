const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function getSiteUrl() {
    return (process.env.SITE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || 'https://promoping.pt').replace(/\/$/, '');
}

function buildAlreadyConnectedEmbed(linkedAccount) {
    const site = getSiteUrl();
    const email = linkedAccount?.Email || linkedAccount?.email || 'conta PromoPing';

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle('Conta já conectada')
                .setDescription(
                    `O teu Discord já está ligado ao PromoPing.\n\n` +
                    `**Conta:** ${email}\n\n` +
                    'Gerencia a ligação ou acede ao painel no site.'
                )
                .setColor(0x5865f2)
                .setTimestamp(),
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Gerir ligação')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/dashboard/perfil`),
                new ButtonBuilder()
                    .setLabel('Abrir painel')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/dashboard`)
            ),
        ],
    };
}

function buildLoginEmbed() {
    const site = getSiteUrl();

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle('Conectar conta PromoPing')
                .setDescription(
                    'Para usar produtos e alertas no Discord, liga a tua conta no site.\n\n' +
                    '**Opção recomendada:** conectar com Discord (um clique).\n' +
                    '**Alternativa:** entrar com email e palavra-passe no site.'
                )
                .setColor(0x5865f2)
                .setTimestamp(),
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Conectar com Discord')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/auth/discord`),
                new ButtonBuilder()
                    .setLabel('Entrar no site')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/?login=1`)
            ),
        ],
    };
}

function buildRegisterEmbed() {
    const site = getSiteUrl();

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle('Criar conta PromoPing')
                .setDescription(
                    'O registo é feito no site PromoPing.\n\n' +
                    'Cria a tua conta, adiciona produtos e depois volta ao Discord para receber alertas.'
                )
                .setColor(0x57f287)
                .setTimestamp(),
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Registar no PromoPing')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/?register=1`),
                new ButtonBuilder()
                    .setLabel('Já tenho conta — conectar')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`${site}/auth/discord`)
            ),
        ],
    };
}

module.exports = {
    getSiteUrl,
    buildAlreadyConnectedEmbed,
    buildLoginEmbed,
    buildRegisterEmbed,
};
