const { EmbedBuilder } = require("discord.js");

async function resolveTarget(message, args, client) {
    const mentionedUser = message.mentions.users.first();
    if (mentionedUser) {
        return mentionedUser;
    }

    const raw = String(args[0] || "").replace(/[<@!>]/g, "").trim();
    if (!raw) {
        return message.author;
    }

    return client.users.fetch(raw).catch(() => null);
}

module.exports = {
    name: "profile",
    aliases: ["pf", "pr"],
    description: "Mostra um resumo do perfil Discord do utilizador.",
    category: "profile",
    usage: "!profile [@utilizador|id]",
    execute: async (client, message, args) => {
        try {
            const targetUser = await resolveTarget(message, args, client);
            if (!targetUser) {
                await message.reply("Utilizador nao encontrado.");
                return;
            }

            const targetMember = message.guild
                ? await message.guild.members.fetch(targetUser.id).catch(() => null)
                : null;
            const fullUser = await client.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);
            const roleCount = targetMember
                ? targetMember.roles.cache.filter((role) => role.id !== message.guild.id).size
                : 0;

            const embed = new EmbedBuilder()
                .setTitle(`Perfil de ${fullUser.username}`)
                .setColor(0xf59e0b)
                .setThumbnail(fullUser.displayAvatarURL({ size: 256 }))
                .addFields(
                    { name: "Tag", value: fullUser.tag, inline: true },
                    { name: "ID", value: fullUser.id, inline: true },
                    { name: "Conta criada", value: `<t:${Math.floor(fullUser.createdTimestamp / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            if (targetMember) {
                embed.addFields(
                    { name: "Entrou no servidor", value: targetMember.joinedTimestamp ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : "Desconhecido", inline: false },
                    { name: "Apelido", value: targetMember.nickname || "Nenhum", inline: true },
                    { name: "Cargos", value: String(roleCount), inline: true }
                );
            }

            const bannerUrl = fullUser.bannerURL?.({ size: 512 });
            if (bannerUrl) {
                embed.setImage(bannerUrl);
            }

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error("[DISCORD] Erro no comando profile:", error.message);
            await message.reply("Nao consegui mostrar esse perfil.").catch(() => {});
        }
    },
};
