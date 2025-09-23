import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Mostra os comandos disponíveis do PromoPing Bot');

export async function execute(interaction) {
    const embed = new EmbedBuilder()
        .setColor('#e47f7f')
        .setTitle('PromoPing')
        .setDescription('Bot focado em te notificar sobre seus produtos!')
        .setImage('https://raw.githubusercontent.com/juliareboucasleite/Pap/main/Photos/PromoPingBanner.png')
        .setAuthor({ name: 'PromoPing', iconURL: 'https://raw.githubusercontent.com/juliareboucasleite/Pap/main/Photos/Logo.png' })
        .setFooter({ text: 'PromoPing • Sempre conectado' })
        .setTimestamp()
        .addFields(
            { name: '/registrar', value: 'Registra uma nova conta no PromoPing' },
            { name: '/login', value: 'Faz login na sua conta' },
            { name: '/sincronizar', value: 'Sincroniza com conta existente no site' },
            { name: '/meus-produtos', value: 'Lista seus produtos monitorados' },
            { name: '/adicionar-produto', value: 'Adiciona um novo produto' }
        );

    const button1 = new ButtonBuilder()
        .setCustomId('comandos')
        .setLabel('Lista de Comandos')
        .setStyle(ButtonStyle.Success);

    const button2 = new ButtonBuilder()
        .setCustomId('cancelar')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(button1, button2);
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}