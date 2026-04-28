const { EmbedBuilder } = require('discord.js');
const mysql = require('../../mysql2-compat');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'login',
    aliases: ['entrar', 'signin', 'auth'],
    description: 'Faz login na sua conta PromoPing usando email e senha.',
    usage: '!login <email> <senha>',
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

            // Verificar argumentos
            if (args.length < 2) {
                await connection.end();
                return message.reply(' **Uso correto:** `!login <email> <senha>`\n**Exemplo:** `!login joao@email.com minhasenha123`');
            }

            const email = args[0].toLowerCase();
            const senha = args[1];

            // Buscar usuário
            const [users] = await connection.execute(
                'SELECT ReferenciaID, Email, SenhaHash, discord_id FROM utilizadores WHERE Email = ?',
                [email]
            );

            if (users.length === 0) {
                await connection.end();
                return message.reply(' **Email não encontrado!** Verifique o email ou use `!registar` para criar uma conta.');
            }

            const user = users[0];

            // Verificar se já está vinculado a outro Discord
            if (user.discord_id && user.discord_id !== message.author.id) {
                await connection.end();
                return message.reply(' **Este email já está vinculado a outro Discord!** Use outro email ou crie uma nova conta.');
            }

            // Verificar senha
            const senhaValida = await bcrypt.compare(senha, user.SenhaHash);
            if (!senhaValida) {
                await connection.end();
                return message.reply(' **Senha incorreta!** Verifique sua senha e tente novamente.');
            }

            // Verificar se este Discord já está vinculado a outra conta (evita ER_DUP_ENTRY)
            const [outro] = await connection.execute(
                'SELECT ReferenciaID, Email FROM utilizadores WHERE discord_id = ? AND ReferenciaID != ?',
                [message.author.id, user.ReferenciaID]
            );
            if (outro.length > 0) {
                await connection.end();
                return message.reply(' **Este Discord já está vinculado a outra conta.** Faça login com o email dessa conta ou desvincule no site e tente outra vez.');
            }

            // Atualizar Discord ID e último login
            await connection.execute(
                'UPDATE utilizadores SET discord_id = ?, UltimoLogin = ? WHERE ReferenciaID = ?',
                [message.author.id, new Date(), user.ReferenciaID]
            );

            // Buscar estatísticas do usuário
            const [produtos] = await connection.execute(
                'SELECT COUNT(*) as total FROM produtos WHERE ReferenciaID = ? AND DeletedAt IS NULL',
                [user.ReferenciaID]
            );

            const [mudancasHoje] = await connection.execute(`
                SELECT COUNT(*) as total 
                FROM historicoprecos hp 
                JOIN produtos p ON hp.ProdutoId = p.Id 
                WHERE p.ReferenciaID = ? AND DATE(hp.DataRegisto) = CURDATE()
            `, [user.ReferenciaID]);

            await connection.end();

            const embed = new EmbedBuilder()
                .setTitle('Login Realizado!')
                .setDescription(`**Bem-vindo de volta, ${message.author.username}!**`)
                .addFields(
                    {
                        name: 'Sua Conta',
                        value: `**Email:** ${user.Email}\n**Discord:** ${message.author.username}`,
                        inline: true
                    },
                    {
                        name: 'Seus Produtos',
                        value: `**Monitorados:** ${produtos[0].total}\n**Mudanças hoje:** ${mudancasHoje[0].total}`,
                        inline: true
                    }
                )
                .addFields({
                    name: 'Comandos Disponíveis',
                    value: '• `!produtos` — Ver seus produtos\n• `!status` — Ver estatísticas\n• `!ajuda` — Lista de comandos',
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('[DISCORD] Erro no comando login:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
