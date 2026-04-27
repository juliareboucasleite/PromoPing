const { EmbedBuilder } = require('discord.js');
const mysql = require('../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

module.exports = {
    name: 'status',
    aliases: ['info', 'stats'],
    description: 'Mostra informações sobre o sistema PromoPing e estatísticas do bot.',
    execute: async (client, message, args, botInstance) => {
        try {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'papv5',
                port: parseInt(process.env.DB_PORT) || 5432
            };

            const connection = await mysql.createConnection(dbConfig);
            
            // Estatísticas do banco
            const [productCount] = await connection.execute('SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL');
            const [userCount] = await connection.execute("SELECT COUNT(*) as total FROM utilizadores WHERE discord_id IS NOT NULL AND discord_id <> ''");
            const [changesToday] = await connection.execute('SELECT COUNT(*) as total FROM historicoprecos WHERE DATE(DataRegisto) = CURDATE()');
            
            await connection.end();

            const embed = new EmbedBuilder()
                .setTitle('Status do PromoPing Bot')
                .addFields(
                    { name: 'Status', value: botInstance.isMonitoring ? '🟢 Ativo' : '🔴 Parado', inline: true },
                    { name: 'Uptime', value: formatUptime(), inline: true },
                    { name: 'Última Verificação', value: botInstance.lastCheck.toLocaleString('pt-PT'), inline: true },
                    { name: 'Produtos Monitorados', value: productCount[0].total.toString(), inline: true },
                    { name: 'Usuários Discord', value: userCount[0].total.toString(), inline: true },
                    { name: 'Mudanças Hoje', value: changesToday[0].total.toString(), inline: true },
                    { name: 'Intervalo', value: `${botInstance.checkInterval} minutos`, inline: true },
                    { name: 'Servidores', value: client.guilds.cache.size.toString(), inline: true },
                    { name: 'Prefixo', value: botInstance.prefix, inline: true }
                )
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Monitor de Preços' });

            if (process.env.PROMOPING_LOGO_URL) {
                embed.setThumbnail(process.env.PROMOPING_LOGO_URL);
            }

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro ao obter status:', error);
            await message.reply(' Erro ao obter status do bot.');
        }
    }
};

function formatUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
}
