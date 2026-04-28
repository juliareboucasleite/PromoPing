const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const path = require("path");
const fs = require("fs");
const mysql = require("../mysql2-compat");

function buildCategoryOrder(categories) {
    const preferred = ["Sistema", "Conta", "Produtos", "Ticket", "Youtube", "Moderation", "Social", "Comunidade", "Paineis", "birthday", "Geral"];
    const orderMap = new Map(preferred.map((name, index) => [name.toLowerCase(), index]));

    return [...categories].sort((a, b) => {
        const aOrder = orderMap.has(a.toLowerCase()) ? orderMap.get(a.toLowerCase()) : Number.MAX_SAFE_INTEGER;
        const bOrder = orderMap.has(b.toLowerCase()) ? orderMap.get(b.toLowerCase()) : Number.MAX_SAFE_INTEGER;

        if (aOrder !== bOrder) {
            return aOrder - bOrder;
        }

        return a.localeCompare(b);
    });
}

module.exports = {
    name: "ajuda",
    aliases: ["help", "comandos", "h"],
    description: "Mostra a lista de comandos disponiveis e estatisticas do sistema com paginacao.",
    category: "Sistema",
    execute: async (client, message) => {
        const comandos = require("./index");

        const dbConfig = {
            host: process.env.DB_HOST || "localhost",
            user: process.env.DB_USER || "postgres",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "papv5",
            port: parseInt(process.env.DB_PORT, 10) || 5432,
        };

        const stats = {
            totalProdutos: 0,
            totalUsuarios: 0,
            usuariosDiscord: 0,
            mudancasHoje: 0,
        };

        try {
            const connection = await mysql.createConnection(dbConfig);
            const [produtos] = await connection.execute("SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL");
            const [usuarios] = await connection.execute("SELECT COUNT(*) as total FROM utilizadores");
            const [usuariosDiscord] = await connection.execute("SELECT COUNT(*) as total FROM utilizadores WHERE discord_id IS NOT NULL AND discord_id <> ''");
            const [mudancas] = await connection.execute("SELECT COUNT(*) as total FROM historicoprecos WHERE DATE(DataRegisto) = CURDATE()");

            stats.totalProdutos = produtos[0]?.total || 0;
            stats.totalUsuarios = usuarios[0]?.total || 0;
            stats.usuariosDiscord = usuariosDiscord[0]?.total || 0;
            stats.mudancasHoje = mudancas[0]?.total || 0;

            await connection.end();
        } catch (error) {
            console.error("[DISCORD] Erro ao buscar estatisticas:", error.message);
        }

        const imagePath = path.join(__dirname, "../../frontend/assets/images/PromoPing.png");
        const imageAttachment = fs.existsSync(imagePath)
            ? { attachment: imagePath, name: "PromoPing.png" }
            : null;

        const comandosUnicos = new Map();
        comandos.forEach((cmd) => {
            if (!comandosUnicos.has(cmd.name)) {
                comandosUnicos.set(cmd.name, cmd);
            }
        });

        const comandosArray = Array.from(comandosUnicos.values()).sort((a, b) => a.name.localeCompare(b.name));
        const groupedCommands = new Map();

        for (const command of comandosArray) {
            const categoryName = String(command.category || "Geral").trim() || "Geral";
            if (!groupedCommands.has(categoryName)) {
                groupedCommands.set(categoryName, []);
            }
            groupedCommands.get(categoryName).push(command);
        }

        const sortedCategories = buildCategoryOrder(groupedCommands.keys());
        const paginas = [{
            titulo: "Estatisticas do Sistema",
            conteudo: [
                "**Sistema de monitoramento de precos via Discord**",
                "Todos os comandos comecam com o prefixo `!`.",
                "",
                "**Estatisticas Atuais:**",
                `- Produtos monitorados: **${stats.totalProdutos}**`,
                `- Utilizadores cadastrados: **${stats.totalUsuarios}**`,
                `- Utilizadores Discord: **${stats.usuariosDiscord}**`,
                `- Mudancas hoje: **${stats.mudancasHoje}**`,
                "",
                "**Categorias carregadas:**",
                sortedCategories.length > 0 ? `- ${sortedCategories.join(", ")}` : "- Nenhuma",
                "",
                "**Admin:** usa \`!helpadmin\` para configuracao e moderacao.",
            ].join("\n"),
        }];

        for (const categoryName of sortedCategories) {
            const categoryCommands = groupedCommands.get(categoryName) || [];
            paginas.push({
                titulo: `Categoria: ${categoryName}`,
                conteudo: categoryCommands
                    .map((cmd) => {
                        const aliases = Array.isArray(cmd.aliases) && cmd.aliases.length > 0
                            ? ` (${cmd.aliases.join(", ")})`
                            : "";
                        return `- \`!${cmd.name}\`${aliases} - ${cmd.description || "Sem descricao."}`;
                    })
                    .join("\n") || "Nenhum comando disponivel nesta categoria.",
            });
        }

        let paginaAtual = 0;

        const criarEmbed = (paginaIndex) => {
            const pagina = paginas[paginaIndex];
            const embed = new EmbedBuilder()
                .setTitle(`PromoPing Bot - ${pagina.titulo}`)
                .setDescription(pagina.conteudo)
                .setColor(0xffa500)
                .setTimestamp()
                .setFooter({
                    text: `Pagina ${paginaIndex + 1} de ${paginas.length} - PromoPing`,
                    iconURL: process.env.PROMOPING_LOGO_URL || (imageAttachment ? "attachment://PromoPing.png" : ""),
                });

            if (imageAttachment) {
                embed.setThumbnail("attachment://PromoPing.png");
            }

            return embed;
        };

        const criarBotoes = (paginaIndex) => {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ajuda_anterior_${message.author.id}`)
                    .setLabel("Anterior")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(paginaIndex === 0),
                new ButtonBuilder()
                    .setCustomId(`ajuda_proximo_${message.author.id}`)
                    .setLabel("Proximo")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(paginaIndex === paginas.length - 1),
                new ButtonBuilder()
                    .setCustomId(`ajuda_fechar_${message.author.id}`)
                    .setLabel("Fechar")
                    .setStyle(ButtonStyle.Danger)
            );
        };

        const payload = {
            embeds: [criarEmbed(paginaAtual)],
            components: [criarBotoes(paginaAtual)],
            files: imageAttachment ? [imageAttachment] : [],
        };

        if (!message.channel) {
            await message.reply({ ...payload, components: [] });
            return;
        }

        const mensagemInicial = await message.reply(payload);
        const mensagemId = mensagemInicial.id || mensagemInicial.message?.id || null;

        const filter = (interaction) => {
            const sameUser = interaction.user.id === message.author.id;
            const sameMessage = !mensagemId || interaction.message?.id === mensagemId;
            const validButton = interaction.customId.startsWith(`ajuda_anterior_${message.author.id}`)
                || interaction.customId.startsWith(`ajuda_proximo_${message.author.id}`)
                || interaction.customId.startsWith(`ajuda_fechar_${message.author.id}`);

            return sameUser && sameMessage && validButton;
        };

        const collector = message.channel.createMessageComponentCollector({
            filter,
            time: 300000,
        });

        collector.on("collect", async (interaction) => {
            try {
                if (interaction.customId.startsWith("ajuda_anterior_") && paginaAtual > 0) {
                    paginaAtual -= 1;
                } else if (interaction.customId.startsWith("ajuda_proximo_") && paginaAtual < paginas.length - 1) {
                    paginaAtual += 1;
                } else if (interaction.customId.startsWith("ajuda_fechar_")) {
                    await interaction.update({
                        embeds: [criarEmbed(paginaAtual)],
                        components: [],
                        files: imageAttachment ? [imageAttachment] : [],
                    });
                    collector.stop();
                    return;
                }

                await interaction.update({
                    embeds: [criarEmbed(paginaAtual)],
                    components: [criarBotoes(paginaAtual)],
                    files: imageAttachment ? [imageAttachment] : [],
                });
            } catch (error) {
                console.error("[DISCORD] Erro ao processar interacao de ajuda:", error.message);
                await interaction.reply({
                    content: "Ocorreu um erro ao navegar na ajuda.",
                    ephemeral: true,
                }).catch(() => {});
            }
        });

        collector.on("end", () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ajuda_anterior_${message.author.id}_disabled`)
                    .setLabel("Anterior")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`ajuda_proximo_${message.author.id}_disabled`)
                    .setLabel("Proximo")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId(`ajuda_fechar_${message.author.id}_disabled`)
                    .setLabel("Fechar")
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            );

            mensagemInicial.edit({ components: [disabledRow] }).catch(() => {});
        });
    },
};
