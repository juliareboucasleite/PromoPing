// backend/bots/discord.js
import { Client, Collection, GatewayIntentBits, Events } from "discord.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// necessário porque estás a usar ESModules
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Coleção para armazenar os comandos
client.commands = new Collection();

// Caminho para a pasta de comandos
const comandosPath = path.join(__dirname, "../../comandos discord");
const arquivosComando = fs.readdirSync(comandosPath).filter(file => file.endsWith(".js"));

// Carrega cada comando da pasta
for (const file of arquivosComando) {
    const filePath = path.join(comandosPath, file);
    try {
        // Converter caminho Windows para URL válida
        const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
        const comando = await import(fileUrl);
        if (comando.data && comando.execute) {
            client.commands.set(comando.data.name, comando);
        }
    } catch (error) {
        console.log(`⚠️ Erro ao carregar comando ${file}:`, error.message);
    }
}

client.once("ready", () => {
    console.log(`✅ Bot do Discord logado como ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const comando = client.commands.get(interaction.commandName);
            if (!comando) return;

            await comando.execute(interaction);
        } else if (interaction.isModalSubmit()) {
            // Handler para modais
            const modalHandlers = {
                'adicionar_produto_modal': 'adicionar-produto',
                'sincronizar_modal': 'sincronizar'
            };
            
            const handlerName = modalHandlers[interaction.customId];
            if (handlerName) {
                const comando = client.commands.get(handlerName);
                if (comando && comando.handleModal) {
                    await comando.handleModal(interaction);
                }
            }
        } else if (interaction.isButton()) {
            // Handler para botões
            if (interaction.customId.startsWith('produtos_pagina_')) {
                const pagina = parseInt(interaction.customId.split('_')[2]);
                const comando = client.commands.get('meus-produtos');
                if (comando) {
                    // Simular comando com opção de página
                    interaction.options = {
                        getInteger: (name) => name === 'pagina' ? pagina : null
                    };
                    await comando.execute(interaction);
                }
            } else if (interaction.customId === 'adicionar_produto') {
                const comando = client.commands.get('adicionar-produto');
                if (comando) {
                    await comando.execute(interaction);
                }
            }
        }
    } catch (error) {
        console.error('Erro na interação:', error);
        if (interaction.isRepliable()) {
            await interaction.reply({ content: "❌ Erro ao executar a ação.", ephemeral: true });
        }
    }
});

function initDiscordBot() {
    return client.login(process.env.DISCORD_TOKEN);
}

function sendDiscord(userId, mensagem) {
    client.users.fetch(userId).then(user => {
        user.send(mensagem);
    }).catch(err => {
        console.log("⚠ Não foi possível enviar mensagem ao usuário:", err);
    });
}

export { client, sendDiscord, initDiscordBot };