const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    buildAuditReason,
    getInvoker,
    sanitizeText,
    validateTargetMember,
} = require("../../../toolkit/helpers/moderation-security");

module.exports = class BanCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "ban",
            aliases: ["fuckoff", "fuckban"],
            description: "Ban a member with strict hierarchy and abuse-prevention checks.",
            usage: ["ban <user> [reason]"],
            category: "Moderation",
            userPerms: ["BanMembers"],
            botPerms: ["ViewChannel", "SendMessages", "BanMembers"],
            cooldown: 20,
            image: "https://i.imgur.com/rHHi6se.png",
            options: [
                { type: 6, name: "user", description: "User to ban", required: true },
                { type: 3, name: "reason", description: "Reason for the ban", required: false },
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
            action: "ban",
        });
        if (!gate.ok) {
            return this.respond(target, "Ban Blocked", [gate.error]);
        }

        const reason = buildAuditReason(
            "Ban",
            getInvoker(target)?.username || "Unknown User",
            reasonInput
        );

        try {
            await member.send({
                content: sanitizeText(
                    `You were banned from ${target.guild.name}. Reason: ${reasonInput || "No reason provided."}`,
                    { maxLength: 400 }
                ),
                allowedMentions: { parse: [] },
            }).catch(() => {});

            await member.ban({ deleteMessageSeconds: 60 * 60 * 24 * 7, reason });

            return this.respond(target, "User Banned", [
                `Banned **${member.user.tag}**.`,
                `Reason: ${sanitizeText(reasonInput, { fallback: "No reason provided.", maxLength: 180 })}`,
            ]);
        } catch (error) {
            return this.respond(target, "Ban Failed", [
                sanitizeText(error?.message, {
                    fallback: "Discord rejected that ban request.",
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
