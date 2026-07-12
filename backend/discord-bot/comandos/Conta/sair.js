const { EmbedBuilder } = require('discord.js');
const mysql = require('../../mysql2-compat');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'sair',
    aliases: ['logout', 'desconectar', 'unlink'],
    description: 'Desvincula sua conta Discord e permite fazer login com outra conta.',
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

            // Verificar se o usuário está registado
            const [users] = await connection.execute(
                'SELECT ReferenciaID, Email, Nome FROM utilizadores WHERE discord_id = ?',
                [message.author.id]
            );

            if (users.length === 0) {
                await connection.end();
                return message.reply(' **Você não está registado!** Use `!registar` para criar conta no site PromoPing.');
            }

            const user = users[0];

            // Desvincular Discord ID
            await connection.execute(
                'UPDATE utilizadores SET discord_id = NULL, UltimoLogin = ? WHERE ReferenciaID = ?',
                [new Date(), user.ReferenciaID]
            );

            await connection.end();

            const embed = new EmbedBuilder()
                .setTitle('👋 Conta Desvinculada!')
                .setDescription(`**${message.author.username}**, sua conta foi desvinculada com sucesso.`)
                .addFields(
                    {
                        name: 'Conta Desvinculada',
                        value: `**Email:** ${user.Email}\n**Nome:** ${user.Nome}`,
                        inline: true
                    },
                    {
                        name: 'O que aconteceu?',
                        value: '• Seu Discord foi desvinculado da conta\n• Você pode fazer login com outra conta\n• Seus produtos continuam salvos no sistema',
                        inline: false
                    }
                )
                .addFields({
                    name: 'Próximos Passos',
                    value: '• Use `!registar` para criar nova conta\n• Use `!login` para conectar conta existente\n• Use `!ajuda` para ver todos os comandos',
                    inline: false
                })
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({ text: 'PromoPing - Monitor de Preços' });

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando sair:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
