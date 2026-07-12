const mysql = require('../../mysql2-compat');
const path = require('path');
const { buildAlreadyConnectedEmbed, buildRegisterEmbed } = require('../../utils/accountLinks');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'registar',
    aliases: ['register', 'criar', 'signup', 'registrar'],
    description: 'Abre o site PromoPing para criar conta.',
    usage: '!registar',
    execute: async (client, message) => {
        try {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'papv5',
                port: parseInt(process.env.DB_PORT) || 5432,
            };

            const connection = await mysql.createConnection(dbConfig);

            const [linked] = await connection.execute(
                'SELECT ReferenciaID, Email FROM utilizadores WHERE discord_id = ?',
                [message.author.id]
            );

            await connection.end();

            if (linked.length > 0) {
                return message.reply(buildAlreadyConnectedEmbed(linked[0]));
            }

            return message.reply(buildRegisterEmbed());
        } catch (error) {
            console.error('[DISCORD] Erro no comando registar:', error);
            return message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    },
};
