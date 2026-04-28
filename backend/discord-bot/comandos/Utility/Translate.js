const { EmbedBuilder } = require("discord.js");

function looksLikeLanguageCode(value) {
    return /^[a-z]{2,3}(?:-[a-z]{2})?$/i.test(String(value || "").trim());
}

function extractTranslatedText(payload) {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
        return null;
    }

    return payload[0]
        .map((part) => Array.isArray(part) ? part[0] : "")
        .join("")
        .trim();
}

async function translateText(text, targetLanguage) {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "auto");
    url.searchParams.set("tl", targetLanguage);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Traducao respondeu com ${response.status}`);
    }

    const payload = await response.json();
    const translatedText = extractTranslatedText(payload);
    if (!translatedText) {
        throw new Error("Nao foi possivel traduzir esse texto.");
    }

    return translatedText;
}

module.exports = {
    name: "translate",
    aliases: ["tr", "ts"],
    description: "Traduz texto para outro idioma. Tambem funciona respondendo a uma mensagem.",
    category: "Utility",
    usage: "!translate <idioma> <texto>",
    execute: async (client, message, args) => {
        try {
            let targetLanguage = "en";
            let sourceText = "";

            if (message.reference?.messageId) {
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
                sourceText = referencedMessage?.content?.trim() || "";
                if (args[0] && looksLikeLanguageCode(args[0])) {
                    targetLanguage = args[0].toLowerCase();
                }
            } else {
                const parts = [...args];
                if (parts[0] && looksLikeLanguageCode(parts[0])) {
                    targetLanguage = parts.shift().toLowerCase();
                } else if (parts.length > 1 && looksLikeLanguageCode(parts[parts.length - 1])) {
                    targetLanguage = parts.pop().toLowerCase();
                }
                sourceText = parts.join(" ").trim();
            }

            if (!sourceText) {
                await message.reply("Usa `!translate <idioma> <texto>` ou responde a uma mensagem com `!translate <idioma>`.");
                return;
            }

            await message.channel.sendTyping().catch(() => {});
            const translatedText = await translateText(sourceText, targetLanguage);

            const embed = new EmbedBuilder()
                .setTitle("Traducao")
                .setColor(0x4f46e5)
                .addFields(
                    { name: "Idioma", value: targetLanguage.toUpperCase(), inline: true },
                    { name: "Original", value: sourceText.slice(0, 1024), inline: false },
                    { name: "Traduzido", value: translatedText.slice(0, 1024), inline: false }
                )
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error("[DISCORD] Erro no comando translate:", error.message);
            await message.reply(`Nao consegui traduzir o texto: ${error.message}`).catch(() => {});
        }
    },
};
