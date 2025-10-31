const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');

module.exports = {
    name: 'ajuda',
    aliases: ['help', 'comandos', 'h'],
    description: 'Mostra a lista de comandos disponíveis e estatísticas do sistema com paginação.',
    execute: async (client, message, args, botInstance) => {
        const comandos = require('./index');
        
        // Configuração do banco de dados
        const dbConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'pap',
            port: parseInt(process.env.DB_PORT) || 3306
        };

        // Buscar estatísticas da base de dados
        let stats = {
            totalProdutos: 0,
            totalUsuarios: 0,
            usuariosDiscord: 0,
            mudancasHoje: 0
        };

        try {
            const connection = await mysql.createConnection(dbConfig);
            
            // Contar produtos ativos
            const [produtos] = await connection.execute('SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL');
            stats.totalProdutos = produtos[0].total;
            
            // Contar usuários totais
            const [usuarios] = await connection.execute('SELECT COUNT(*) as total FROM utilizadores');
            stats.totalUsuarios = usuarios[0].total;
            
            // Contar usuários com Discord
            const [usuariosDiscord] = await connection.execute('SELECT COUNT(*) as total FROM utilizadores WHERE discord_id IS NOT NULL AND discord_id != ""');
            stats.usuariosDiscord = usuariosDiscord[0].total;
            
            // Contar mudanças de preço hoje
            const [mudancas] = await connection.execute('SELECT COUNT(*) as total FROM historicoprecos WHERE DATE(DataRegisto) = CURDATE()');
            stats.mudancasHoje = mudancas[0].total;
            
            await connection.end();
        } catch (error) {
            console.error('[DISCORD] Erro ao buscar estatísticas:', error);
        }

        // Caminho da imagem local (opcional)
        const imagePath = path.join(__dirname, '../../frontend/assets/images/PromoPing.png');
        let imageAttachment = null;
        if (fs.existsSync(imagePath)) {
            imageAttachment = { attachment: imagePath, name: 'PromoPing.png' };
        }

        // Gerar comandos únicos (remove aliases duplicados)
        const comandosUnicos = new Map();
        comandos.forEach(cmd => {
            if (!comandosUnicos.has(cmd.name)) comandosUnicos.set(cmd.name, cmd);
        });

        const comandosArray = Array.from(comandosUnicos.values());

        // Definir páginas
        const paginas = [
            {
                titulo: '📊 Estatísticas do Sistema',
                conteudo: [
                    '**Sistema de monitoramento de preços via Discord**',
                    'Todos os comandos começam com o prefixo `!` (configurável).',
                    '',
                    '**Estatísticas Atuais:**',
                    `• Produtos monitorados: **${stats.totalProdutos}**`,
                    `• Usuários cadastrados: **${stats.totalUsuarios}**`,
                    `• Usuários Discord: **${stats.usuariosDiscord}**`,
                    `• Mudanças hoje: **${stats.mudancasHoje}**`,
                    '',
                    '**Funcionalidades:**',
                    '• Monitoramento automático de preços',
                    '• Notificações privadas sobre mudanças',
                    '• Sistema conectado à base de dados em tempo real',
                    '• Prefixo configurável via `.env`'
                ].join('\n')
            },
            {
                titulo: 'Comandos Básicos',
                conteudo: comandosArray
                    .filter(cmd => ['ping', 'status', 'ajuda'].includes(cmd.name))
                    .map(cmd => {
                        const aliases = cmd.aliases && cmd.aliases.length
                            ? ` (${cmd.aliases.join(', ')})`
                            : '';
                        return `• \`!${cmd.name}\`${aliases} — ${cmd.description}`;
                    })
                    .join('\n') || 'Nenhum comando básico disponível'
            },
            {
                titulo: 'Comandos de Autenticação',
                conteudo: comandosArray
                    .filter(cmd => ['registar', 'login', 'sair'].includes(cmd.name))
                    .map(cmd => {
                        const aliases = cmd.aliases && cmd.aliases.length
                            ? ` (${cmd.aliases.join(', ')})`
                            : '';
                        return `• \`!${cmd.name}\`${aliases} — ${cmd.description}`;
                    })
                    .join('\n') || 'Nenhum comando de autenticação disponível'
            },
            {
                titulo: 'Comandos de Produtos',
                conteudo: comandosArray
                    .filter(cmd => ['produtos', 'iniciar', 'parar'].includes(cmd.name))
                    .map(cmd => {
                        const aliases = cmd.aliases && cmd.aliases.length
                            ? ` (${cmd.aliases.join(', ')})`
                            : '';
                        return `• \`!${cmd.name}\`${aliases} — ${cmd.description}`;
                    })
                    .join('\n') || 'Nenhum comando de produtos disponível'
            },
        ];

        let paginaAtual = 0;

        // Função para criar embed da página atual
        const criarEmbed = (paginaIndex) => {
            const pagina = paginas[paginaIndex];
            return new EmbedBuilder()
                .setTitle(`PromoPing Bot — ${pagina.titulo}`)
                .setDescription(pagina.conteudo)
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({
                    text: `Página ${paginaIndex + 1} de ${paginas.length} • PromoPing - Monitor de Preços`,
                    iconURL: process.env.PROMOPING_LOGO_URL || (imageAttachment ? 'attachment://PromoPing.png' : '')
                });
        };

        // Criar botões de navegação
        const criarBotoes = (paginaIndex) => {
            const row = new ActionRowBuilder();
            
            // Botão página anterior
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ajuda_anterior_${message.author.id}`)
                    .setLabel('◀️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(paginaIndex === 0)
            );
            
            // Botão página seguinte
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ajuda_proximo_${message.author.id}`)
                    .setLabel('Próximo ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(paginaIndex === paginas.length - 1)
            );
            
            // Botão fechar
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ajuda_fechar_${message.author.id}`)
                    .setLabel('❌ Fechar')
                    .setStyle(ButtonStyle.Danger)
            );

            return row;
        };

        // Enviar mensagem inicial
        const mensagemInicial = await message.reply({
            embeds: [criarEmbed(paginaAtual)],
            components: [criarBotoes(paginaAtual)],
            files: imageAttachment ? [imageAttachment] : []
        });

        // Configurar coletor de interações
        const filter = (interaction) => {
            return interaction.user.id === message.author.id && 
                   (interaction.customId.startsWith(`ajuda_anterior_${message.author.id}`) ||
                    interaction.customId.startsWith(`ajuda_proximo_${message.author.id}`) ||
                    interaction.customId.startsWith(`ajuda_fechar_${message.author.id}`));
        };

        const collector = mensagemInicial.createMessageComponentCollector({ 
            filter, 
            time: 300000 // 5 minutos
        });

        collector.on('collect', async (interaction) => {
            try {
                if (interaction.customId.startsWith('ajuda_anterior_')) {
                    if (paginaAtual > 0) {
                        paginaAtual--;
                        await interaction.update({
                            embeds: [criarEmbed(paginaAtual)],
                            components: [criarBotoes(paginaAtual)],
                            files: imageAttachment ? [imageAttachment] : []
                        });
                    }
                } else if (interaction.customId.startsWith('ajuda_proximo_')) {
                    if (paginaAtual < paginas.length - 1) {
                        paginaAtual++;
                        await interaction.update({
                            embeds: [criarEmbed(paginaAtual)],
                            components: [criarBotoes(paginaAtual)],
                            files: imageAttachment ? [imageAttachment] : []
                        });
                    }
                } else if (interaction.customId.startsWith('ajuda_fechar_')) {
                    await interaction.update({
                        embeds: [criarEmbed(paginaAtual)],
                        components: [],
                        files: imageAttachment ? [imageAttachment] : []
                    });
                    collector.stop();
                }
            } catch (error) {
                console.error('[DISCORD] Erro ao processar interação de ajuda:', error);
                await interaction.reply({ 
                    content: '❌ Ocorreu um erro ao navegar. Tente novamente.', 
                    ephemeral: true 
                });
            }
        });

        collector.on('end', () => {
            // Desabilitar botões após timeout
            const disabledRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ajuda_anterior_${message.author.id}_disabled`)
                        .setLabel('◀️ Anterior')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`ajuda_proximo_${message.author.id}_disabled`)
                        .setLabel('Próximo ▶️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`ajuda_fechar_${message.author.id}_disabled`)
                        .setLabel('❌ Fechar')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );

            mensagemInicial.edit({ components: [disabledRow] }).catch(console.error);
        });
    }
};
