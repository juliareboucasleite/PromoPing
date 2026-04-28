const Command = require("../../abstract/command");
const { PermissionsBitField } = require("discord.js");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    buildAuditReason,
    getInvoker,
    sanitizeText,
    validateTargetMember,
} = require("../../../toolkit/helpers/moderation-security");

module.exports = class TimeoutCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "timeout",
            aliases: ["mute", "tmute", "stfu"],
            description: "Timeout a member with strict hierarchy and safety validation.",
            usage: ["timeout <user> <time> [reason]"],
            category: "Moderation",
            userPerms: ["ModerateMembers"],
            botPerms: ["ViewChannel", "SendMessages", "ModerateMembers"],
            cooldown: 3,
            image: "https://imgur.com/PYD1RBa",
            options: [
                { type: 6, name: "user", description: "User to timeout", required: true },
                { type: 3, name: "time", description: "Timeout length, for example 10m", required: false },
                { type: 3, name: "reason", description: "Reason for the timeout", required: false },
            ],
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    parseDuration(input) {
        if (!input) return 10 * 60 * 1000;
        const normalized = String(input).trim().toLowerCase();
        const match = normalized.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?$/);
        if (!match) return null;

        const value = Number(match[1]);
        const unit = match[2] ?? "m";
        const multipliers = {
            s: 1000,
            sec: 1000,
            secs: 1000,
            second: 1000,
            seconds: 1000,
            m: 60 * 1000,
            min: 60 * 1000,
            mins: 60 * 1000,
            minute: 60 * 1000,
            minutes: 60 * 1000,
            h: 60 * 60 * 1000,
            hr: 60 * 60 * 1000,
            hrs: 60 * 60 * 1000,
            hour: 60 * 60 * 1000,
            hours: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000,
            days: 24 * 60 * 60 * 1000,
        };

        const duration = value * multipliers[unit];
        const maximum = 28 * 24 * 60 * 60 * 1000;
        if (!Number.isFinite(duration) || duration < 1000) return null;
        return Math.min(duration, maximum);
    }

    async perform(target, member, timeInput, reasonInput) {
        const duration = this.parseDuration(timeInput);
        if (!duration) {
            return this.respond(target, "Timeout Blocked", [
                "Provide a valid timeout length like `10m`, `2h`, or `1d`.",
            ]);
        }

        if (member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return this.respond(target, "Timeout Blocked", [
                "I won't timeout a member who currently has Administrator.",
            ]);
        }

        const gate = validateTargetMember({
            client: this.client,
            guild: target.guild,
            actorMember: target.member,
            targetMember: member,
            action: "timeout",
        });
        if (!gate.ok) {
            return this.respond(target, "Timeout Blocked", [gate.error]);
        }

        if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
            return this.respond(target, "Timeout Blocked", [
                "That member is already timed out.",
            ]);
        }

        const reason = buildAuditReason(
            "Timeout",
            getInvoker(target)?.username || "Unknown User",
            reasonInput
        );

        try {
            await member.timeout(duration, reason);
            return this.respond(target, "User Timed Out", [
                `Timed out **${member.user.tag}**.`,
                `Duration: **${Math.round(duration / 60000)} minute(s)**`,
                `Reason: ${sanitizeText(reasonInput, { fallback: "No reason provided.", maxLength: 180 })}`,
            ]);
        } catch (error) {
            return this.respond(target, "Timeout Failed", [
                sanitizeText(error?.message, {
                    fallback: "Discord rejected that timeout request.",
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

        return this.perform(message, member, args[1], args.slice(2).join(" "));
    }

    async exec({ interaction }) {
        const member = interaction.options.getMember("user");
        if (!member) {
            return interaction.reply({ content: "That user is not in this server.", ephemeral: true });
        }

        return this.perform(
            interaction,
            member,
            interaction.options.getString("time"),
            interaction.options.getString("reason")
        );
    }
};
