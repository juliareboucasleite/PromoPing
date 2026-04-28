const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const mysql = require('../../mysql2-compat');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

module.exports = {
    name: 'registar',
    aliases: ['register', 'criar', 'signup', 'registrar', 'registar'],
    description: 'Regista uma nova conta PromoPing e vincula ao Discord.',
    usage: '!registar <email> <senha>',
    execute: async (client, message, args, botInstance) => {
        // Event listener unica para cada mensagem de cadastro enviada
        async function adicionarBotaoDeletar(mensagemEnviada) {
            // Cria o botão "Festejar" (clique para apagar)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`delete_celebrate_${mensagemEnviada.id}`)
                    .setLabel('Festejar')
                    .setStyle(ButtonStyle.Success)
            );

            // Edita a mensagem para incluir o botão
            await mensagemEnviada.edit({ components: [row] });

            // Cria um collector para só esse botão e só para o usuário que registrou
            const filter = (interaction) =>
                interaction.isButton() &&
                interaction.customId === `delete_celebrate_${mensagemEnviada.id}` &&
                interaction.user.id === message.author.id;

            const collector = mensagemEnviada.createMessageComponentCollector({ filter, time: 60_000 });

            collector.on('collect', async (interaction) => {
                // Deleta a mensagem quando o usuário clicar
                await interaction.deferUpdate();
                await mensagemEnviada.delete().catch(() => {});
            });

            collector.on('end', async () => {
                // Remove o botão após timeout, se ainda existir
                if (mensagemEnviada.editable && mensagemEnviada.components.length > 0) {
                    try {
                        await mensagemEnviada.edit({ components: [] });
                    } catch {}
                }
            });
        }

        try {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'papv5',
                port: parseInt(process.env.DB_PORT) || 5432
            };

            const connection = await mysql.createConnection(dbConfig);

            // Verificar se o Discord já está vinculado
            const [existingDiscord] = await connection.execute(
                'SELECT ReferenciaID, Email FROM utilizadores WHERE discord_id = ?',
                [message.author.id]
            );

            if (existingDiscord.length > 0) {
                await connection.end();
                return message.reply(' **Você já está registado!** Use `!login` para fazer login ou `!produtos` para ver seus produtos.');
            }

            // Verificar argumentos
            if (args.length < 2) {
                await connection.end();
                return message.reply(' **Uso correto:** `!registar <email> <senha>`\n**Exemplo:** `!registar joao@email.com minhasenha123`');
            }

            const email = args[0].toLowerCase();
            const senha = args[1];

            // Validar email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                await connection.end();
                return message.reply(' **Email inválido!** Use um formato válido como: `joao@email.com`');
            }

            // Validar senha
            if (senha.length < 6) {
                await connection.end();
                return message.reply(' **Senha muito curta!** Use pelo menos 6 caracteres.');
            }

            // Verificar se email já existe
            const [existingEmail] = await connection.execute(
                'SELECT ReferenciaID, discord_id FROM utilizadores WHERE Email = ?',
                [email]
            );

            if (existingEmail.length > 0) {
                if (existingEmail[0].discord_id) {
                    await connection.end();
                    return message.reply(' **Este email já está vinculado a outro Discord!** Use outro email ou faça login.');
                } else {
                    // Atualizar conta existente com Discord ID
                    await connection.execute(
                        'UPDATE utilizadores SET discord_id = ? WHERE Email = ?',
                        [message.author.id, email]
                    );
                    await connection.end();
                    
                    const embed = new EmbedBuilder()
                        .setTitle('Conta Vinculada!')
                        .setDescription(`**Email:** ${email}\n**Discord:** ${message.author.username}`)
                        .addFields({
                            name: 'Próximos Passos',
                            value: '• Use `!produtos` para ver seus produtos\n• Use `!status` para ver estatísticas\n• O bot monitorará preços automaticamente',
                            inline: false
                        })
                        .setColor(0x00ff00)
                        .setTimestamp();
                    
                    const sent = await message.reply({ embeds: [embed], components: [] });
                    await adicionarBotaoDeletar(sent);
                    return;
                }
            }

            // Criar nova conta
            const hashedPassword = await bcrypt.hash(senha, 10);
            const now = new Date();

            // PERFIL DE USUÁRIO COMUM: busca o id correto do perfil na tabela perfis
            // Consulta pelo nome do perfil "Usuario" OU "Utilizador"
            let userPerfilId = 2; // Valor padrão, em caso de não encontrar na consulta, assume 2
            try {
                // buscar qualquer um: "Usuario" ou "Utilizador" (case insensitive)
                const [perfis] = await connection.execute(
                    "SELECT Id, Nome FROM perfis WHERE LOWER(Nome) IN ('usuario', 'utilizador', 'user') LIMIT 1"
                );
                if (perfis.length > 0) {
                    userPerfilId = perfis[0].Id;
                }
            } catch { /* ignora erro, cai pro valor padrão */ }

            // Gerar ReferenciaID
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let referenciaID = 'REF-';
            for (let i = 0; i < 9; i++) {
                referenciaID += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            await connection.execute(
                'INSERT INTO utilizadores (ReferenciaID, Email, SenhaHash, discord_id, DataRegisto, Nome, Ativo, PerfilId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [referenciaID, email, hashedPassword, message.author.id, now, message.author.username, 1, userPerfilId]
            );

            await connection.end();

            const embed = new EmbedBuilder()
                .setTitle('Conta Criada com Sucesso!')
                .setDescription(`**Email:** ${email}\n**Discord:** ${message.author.username}`)
                .addFields({
                    name: 'Bem-vindo ao PromoPing!',
                    value: '• Use `!produtos` para ver seus produtos\n• Use `!status` para ver estatísticas\n• O bot monitorará preços automaticamente\n• Receba notificações privadas sobre mudanças',
                    inline: false
                })
                .setColor(0x00ff00)
                .setTimestamp();

            const sent = await message.reply({ embeds: [embed], components: [] });
            await adicionarBotaoDeletar(sent);

        } catch (error) {
            console.error('[DISCORD] Erro no comando registar:', error);
            await message.reply(' **Erro interno!** Tente novamente em alguns minutos.');
        }
    }
};
