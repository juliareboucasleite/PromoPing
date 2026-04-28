module.exports = {
    name: "prefix",
    aliases: ["setprefix"],
    description: "Mostra ou altera o prefixo do bot neste servidor.",
    category: "Sistema",
    usage: "!prefix [novo-prefixo]",
    execute: async (client, message, args, botInstance) => {
        if (!message.guild) {
            await message.reply("Este comando so funciona dentro de um servidor.").catch(() => {});
            return;
        }

        const currentPrefix = await botInstance.getGuildPrefix(message.guild.id);
        const requestedPrefix = String(args[0] || "").trim();

        if (!requestedPrefix) {
            await message.reply(`O prefixo atual deste servidor e \`${currentPrefix}\`.`).catch(() => {});
            return;
        }

        const canManagePrefix = botInstance.isAdmin(message.member) || message.member.permissions.has("ManageGuild");
        if (!canManagePrefix) {
            await message.reply("Precisas da permissao `Gerir Servidor` para alterar o prefixo.").catch(() => {});
            return;
        }

        if (requestedPrefix.length > 5) {
            await message.reply("O prefixo pode ter no maximo 5 caracteres.").catch(() => {});
            return;
        }

        await botInstance.setGuildPrefix(message.guild.id, requestedPrefix);
        await message.reply(`O novo prefixo deste servidor e \`${requestedPrefix}\`.`).catch(() => {});
    },
};
