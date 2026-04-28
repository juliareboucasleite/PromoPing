const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    buildAuditReason,
    getInvoker,
    sanitizeText,
    validateTargetMember,
} = require("../../../toolkit/helpers/moderation-security");

module.exports = class KickCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "kick",
            aliases: ["getlost"],
            description: "Kick a member with strict hierarchy and abuse-prevention checks.",
            usage: ["kick <user> [reason]"],
            category: "Moderation",
            userPerms: ["KickMembers"],
            botPerms: ["ViewChannel", "SendMessages", "KickMembers"],
            cooldown: 20,
            image: "https://i.imgur.com/vC7D4x0.png",
            options: [
                { type: 6, name: "user", description: "User to kick", required: true },
                { type: 3, name: "reason", description: "Reason for the kick", required: false },
            ],
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    async perform(target, member, reasonInput) {
        const gate = validateTargetMember({
            client: this.client,
            guild: target.guild,
            actorMember: target.member,
            targetMember: member,
            action: "kick",
        });
        if (!gate.ok) {
            return this.respond(target, "Kick Blocked", [gate.error]);
        }

        const reason = buildAuditReason(
            "Kick",
            getInvoker(target)?.username || "Unknown User",
            reasonInput
        );

        try {
            await member.send({
                content: sanitizeText(
                    `You were kicked from ${target.guild.name}. Reason: ${reasonInput || "No reason provided."}`,
                    { maxLength: 400 }
                ),
                allowedMentions: { parse: [] },
            }).catch(() => {});

            await member.kick(reason);

            return this.respond(target, "User Kicked", [
                `Kicked **${member.user.tag}**.`,
                `Reason: ${sanitizeText(reasonInput, { fallback: "No reason provided.", maxLength: 180 })}`,
            ]);
        } catch (error) {
            return this.respond(target, "Kick Failed", [
                sanitizeText(error?.message, {
                    fallback: "Discord rejected that kick request.",
                    maxLength: 220,
                }),
            ]);
        }
    }

    async run({ message, args }) {
        const userId = await this.client.util.userQuery(args[0]);
        if (!userId) {
            return message.reply({ content: "Provide a valid user or member mention." });
        }

        const member = await message.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return message.reply({ content: "That user is not in this server." });
        }

        return this.perform(message, member, args.slice(1).join(" "));
    }

    async exec({ interaction }) {
        const member = interaction.options.getMember("user");
        if (!member) {
            return interaction.reply({ content: "That user is not in this server.", ephemeral: true });
        }

        return this.perform(interaction, member, interaction.options.getString("reason"));
    }
};
