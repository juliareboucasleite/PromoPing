const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const mysql = require("../../mysql2-compat");
const { buildModules, getModuleByQuery } = require("./helpCatalog");

function uniqueCommands(commandMap) {
    const seen = new Set();
    const list = [];
    commandMap.forEach((command) => {
        if (!seen.has(command.name)) {
            seen.add(command.name);
            list.push(command);
        }
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
}

function formatUsage(prefix, usage) {
    if (!usage) return [];
    const usageList = Array.isArray(usage) ? usage : [usage];
    return usageList.map((entry) => {
        const text = String(entry);
        if (text.startsWith("!") || text.startsWith("/")) {
            return text.replace(/^!/, prefix);
        }
        return `${prefix}${text}`;
    });
}

function chunk(items, size) {
    const pages = [];
    for (let i = 0; i < items.length; i += size) {
        pages.push(items.slice(i, i + size));
    }
    return pages;
}

async function getStats() {
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
        console.error("[DISCORD] Erro ao buscar estatísticas do help:", error.message);
    }

    return stats;
}

module.exports = {
    name: "ajuda",
    aliases: ["help", "comandos", "h"],
    description: "Mostra ajuda por comando, categoria ou módulo, com exemplos de configuração.",
    category: "Sistema",
    usage: "!ajuda [comando|módulo]",
    execute: async (client, message, args, botInstance) => {
        const prefix = message.guild ? await botInstance.getGuildPrefix(message.guild.id) : (process.env.DISCORD_PREFIX || "!");
        const comandos = require("../index");
        const commands = uniqueCommands(comandos);
        const modules = buildModules(prefix);
        const query = args.join(" ").trim();

        if (query) {
            const command = comandos.get(query.toLowerCase());
            if (command) {
                const usageLines = formatUsage(prefix, command.usage);
                const module = getModuleByQuery(command.name, prefix);
                const embed = new EmbedBuilder()
                    .setTitle(`Ajuda: ${prefix}${command.name}`)
                    .setDescription(command.description || "Sem descrição.")
                    .setColor(0xf59e0b)
                    .addFields(
                        { name: "Categoria", value: String(command.category || "Geral"), inline: true },
                        { name: "Aliases", value: command.aliases?.length ? command.aliases.map((alias) => `\`${alias}\``).join(", ") : "Nenhum", inline: false },
                        { name: "Uso", value: usageLines.length ? usageLines.map((line) => `\`${line}\``).join("\n") : "Sem uso documentado.", inline: false },
                    )
                    .setTimestamp();

                if (module) {
                    embed.addFields(
                        { name: "Guia Rápido", value: module.setup.slice(0, 3).map((line) => `• ${line}`).join("\n"), inline: false }
                    );
                }

                return message.reply({ embeds: [embed] });
            }

            const module = getModuleByQuery(query, prefix);
            if (module) {
                const embed = new EmbedBuilder()
                    .setTitle(`Módulo: ${module.title}`)
                    .setDescription(`${module.summary}\n\nEstado: **${module.status}**`)
                    .setColor(module.status === "parcial" ? 0x6366f1 : 0xf59e0b)
                    .addFields(
                        { name: "Comandos", value: module.commands.map((line) => `\`${line}\``).join("\n"), inline: false },
                        { name: "Como Configurar", value: module.setup.map((line) => `• ${line}`).join("\n"), inline: false }
                    )
                    .setTimestamp();

                return message.reply({ embeds: [embed] });
            }

            return message.reply(`Não encontrei ajuda para \`${query}\`. Usa \`${prefix}ajuda\` para ver os módulos disponíveis.`);
        }

        const stats = await getStats();
        const modulePages = chunk(modules, 4).map((group) => ({
            title: "Módulos",
            lines: group.flatMap((module) => [
                `**${module.title}** • ${module.status}`,
                `${module.summary}`,
                `Ex.: \`${module.commands[0]}\``,
                "",
            ]),
        }));

        const pages = [
            {
                title: "Visão Geral",
                lines: [
                    `Prefixo atual: \`${prefix}\``,
                    `Comandos carregados: **${commands.length}**`,
                    `Produtos monitorados: **${stats.totalProdutos}**`,
                    `Utilizadores: **${stats.totalUsuarios}**`,
                    `Contas ligadas ao Discord: **${stats.usuariosDiscord}**`,
                    `Mudanças hoje: **${stats.mudancasHoje}**`,
                    "",
                    `Dica: usa \`${prefix}ajuda welcome\`, \`${prefix}ajuda verify\` ou \`${prefix}ajuda giveaways\` para configuração guiada.`,
                ],
            },
            ...modulePages,
            {
                title: "Atalhos",
                lines: [
                    `\`${prefix}helpadmin\` mostra moderação e setup de staff.`,
                    `\`${prefix}painel\` resume os painéis prontos.`,
                    `\`${prefix}prefix ?\` altera o prefixo do servidor.`,
                    `\`${prefix}music\` mostra o estado real do módulo de música.`,
                ],
            },
        ];

        let pageIndex = 0;

        const buildEmbed = () => new EmbedBuilder()
            .setTitle(`PromoPing Help • ${pages[pageIndex].title}`)
            .setDescription(pages[pageIndex].lines.join("\n"))
            .setColor(0xf59e0b)
            .setFooter({ text: `Página ${pageIndex + 1}/${pages.length}` })
            .setTimestamp();

        const buildButtons = () => new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`help_prev_${message.author.id}`)
                .setLabel("Anterior")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageIndex === 0),
            new ButtonBuilder()
                .setCustomId(`help_next_${message.author.id}`)
                .setLabel("Próxima")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(pageIndex === pages.length - 1),
            new ButtonBuilder()
                .setCustomId(`help_close_${message.author.id}`)
                .setLabel("Fechar")
                .setStyle(ButtonStyle.Danger),
        );

        const reply = await message.reply({
            embeds: [buildEmbed()],
            components: [buildButtons()],
        });

        const collector = reply.createMessageComponentCollector({
            time: 300000,
            filter: (interaction) => {
                return interaction.user.id === message.author.id
                    && ["help_prev_", "help_next_", "help_close_"].some((prefixValue) => interaction.customId.startsWith(prefixValue));
            },
        });

        collector.on("collect", async (interaction) => {
            if (interaction.customId.startsWith("help_prev_") && pageIndex > 0) {
                pageIndex -= 1;
            } else if (interaction.customId.startsWith("help_next_") && pageIndex < pages.length - 1) {
                pageIndex += 1;
            } else if (interaction.customId.startsWith("help_close_")) {
                await interaction.update({ embeds: [buildEmbed()], components: [] });
                collector.stop();
                return;
            }

            await interaction.update({
                embeds: [buildEmbed()],
                components: [buildButtons()],
            });
        });

        collector.on("end", async () => {
            await reply.edit({ components: [] }).catch(() => {});
        });
    },
};
