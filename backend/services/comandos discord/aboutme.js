// Comando simples "about" para mostrar informações básicas sobre o bot de Discord

import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('about')
    .setDescription('Mostra informações sobre o bot.');

export async function execute(interaction) {
    await interaction.reply({
        embeds: [
            {
                color: 0x5865F2,
                title: 'Sobre o PromoPing Bot',
                description: 'Este bot foi criado para conectar você às melhores promoções e facilitar sua experiência na comunidade PromoPing!',
                fields: [
                    { name: 'Site', value: '[Acesse o site](https://promoping.pt)', inline: true },
                    { name: 'GitHub', value: '[Repositório](https://github.com/juliareboucasleite/Pap)', inline: true }
                ],
                footer: { text: 'PromoPing • Sempre conectado' }
            }
        ]
    });
}