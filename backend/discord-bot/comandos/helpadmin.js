const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'helpadmin',
    aliases: ['admin', 'comandosadmin', 'ha'],
    description: 'Lista comandos de administrador (moderação e configuração). Apenas para staff.',
    execute: async (client, message, args, botInstance) => {
        const comandos = require('./index');

        const comandosUnicos = new Map();
        comandos.forEach(cmd => {
            if (!comandosUnicos.has(cmd.name)) comandosUnicos.set(cmd.name, cmd);
        });
        const comandosArray = Array.from(comandosUnicos.values());

        const moderação = comandosArray
            .filter(cmd => ['lock', 'unlock', 'clear'].includes(cmd.name))
            .map(cmd => {
                const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
                let line = `• \`!${cmd.name}\`${aliases} — ${cmd.description}`;
                if (cmd.name === 'clear') line += '\n  `!clear <1-100>` - Apaga mensagens no canal';
                return line;
            })
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('PromoPing Bot — Comandos de Administrador')
            .setDescription(
                '**Apenas utilizadores com permissões de staff podem usar estes comandos.**\n\n' +
                '**Moderação**\n' + (moderação || 'Nenhum') + '\n\n' +
                '**Configuração (apenas admins)**\n' +
                '• `!counting configurar #canal` — Configura canal de contagem\n' +
                '• `!announcements configurar <webhook>` — Configura anúncios\n' +
                '• `!social-feed` — Configura feed (adicionar/listar/verificar)\n' +
                '• `!ticket` — Configura sistema de tickets\n' +
                '• `!news configurar <canal-id>` — Configura notícias\n\n' +
                'Comandos de lock, unlock e clear requerem permissões de gerir canais/mensagens no servidor.'
            )
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({ text: 'PromoPing - Comandos de administrador' });

        await message.reply({ embeds: [embed] });
    }
};
