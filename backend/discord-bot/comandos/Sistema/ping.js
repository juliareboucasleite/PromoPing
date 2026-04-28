const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "ping",
    aliases: ["pong"],
    description: "Mostra a latencia atual do bot e da API do Discord.",
    category: "Sistema",
    execute: async (client, message) => {
        try {
            const probeMessage = await message.reply("A medir latencia...");
            const botLatency = probeMessage.createdTimestamp - message.createdTimestamp;
            const apiLatency = Math.round(client.ws?.ping || 0);

            const embed = new EmbedBuilder()
                .setTitle("Pong")
                .setColor(0xffa500)
                .addFields(
                    { name: "Latencia do bot", value: `\`${botLatency}ms\``, inline: true },
                    { name: "Latencia da API", value: `\`${apiLatency}ms\``, inline: true }
                )
                .setTimestamp();

            await probeMessage.edit({ content: "", embeds: [embed] });
        } catch (error) {
            console.error("[DISCORD] Erro no comando ping:", error.message);
            await message.reply("Nao consegui medir a latencia agora.").catch(() => {});
        }
    },
};
