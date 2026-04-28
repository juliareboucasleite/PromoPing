const Command = require("../../abstract/command");
const { ChannelType } = require("discord.js");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    getGuildAutomodConfig,
    saveGuildAutomodConfig,
    syncNativeRules,
} = require("../../../toolkit/helpers/automod-manager");
const { getInvoker } = require("../../../toolkit/helpers/moderation-security");

module.exports = class AutoModerationCommand extends Command {
    constructor(...args) {
        super(...args, {
            name: "automoderation",
            aliases: ["automod"],
            description: "Configure the shared automod suite for spam, caps, links, mentions, and enforcement.",
            usage: [
                "automoderation <enable|disable|status>",
                "automoderation action <delete|timeout|kick|ban>",
                "automoderation logs <#channel|off>"
            ],
            examples: [
                "automoderation enable",
                "automoderation action timeout",
                "automoderation logs #mod-logs"
            ],
            category: "Moderation",
            userPerms: ["ManageGuild"],
            botPerms: ["ManageGuild", "ViewChannel", "SendMessages"],
            cooldown: 5,
            image: "https://imgur.com/jmraDk4",
            options: [
                { type: 1, name: "enable", description: "Enable the shared automod suite" },
                { type: 1, name: "disable", description: "Disable the shared automod suite" },
                { type: 1, name: "status", description: "Show current shared automod settings" },
                {
                    type: 1,
                    name: "action",
                    description: "Set the default enforcement action",
                    options: [
                        {
                            type: 3,
                            name: "mode",
                            description: "delete, timeout, kick, or ban",
                            required: true,
                            choices: [
                                { name: "Delete", value: "delete" },
                                { name: "Timeout", value: "timeout" },
                                { name: "Kick", value: "kick" },
                                { name: "Ban", value: "ban" },
                            ],
                        },
                    ],
                },
                {
                    type: 1,
                    name: "logs",
                    description: "Set or clear the AutoMod log channel",
                    options: [
                        {
                            type: 7,
                            name: "channel",
                            description: "Channel to receive AutoMod logs",
                            required: false,
                        },
                        {
                            type: 5,
                            name: "disable",
                            description: "Clear the current log channel",
                            required: false,
                        },
                    ],
                },
                {
                    type: 1,
                    name: "timeout",
                    description: "Set the timeout duration used by AutoMod",
                    options: [
                        {
                            type: 4,
                            name: "minutes",
                            description: "Timeout duration in minutes",
                            required: true,
                        },
                    ],
                },
            ],
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    describe(config) {
        return [
            `Enabled: **${config.enabled ? "Yes" : "No"}**`,
            `Mass mentions: **${config.massMention.enabled ? `On (${config.massMention.limit})` : "Off"}**`,
            `Invite links: **${config.inviteLinks.enabled ? "On" : "Off"}**`,
            `External links: **${config.externalLinks.enabled ? "On" : "Off"}**`,
            `Caps filter: **${config.caps.enabled ? "On" : "Off"}**`,
            `Spam filter: **${config.spam.enabled ? `On (${config.spam.maxMessages}/${Math.round(config.spam.intervalMs / 1000)}s)` : "Off"}**`,
            `Repeat filter: **${config.repeatedMessages.enabled ? `On (${config.repeatedMessages.threshold})` : "Off"}**`,
            `Action: **${config.action}**`,
            `Timeout length: **${Math.round((config.timeoutDurationMs || 0) / 60000)} minute(s)**`,
            `Log channel: **${config.logChannelId ? `<#${config.logChannelId}>` : "Not set"}**`,
        ];
    }

    async saveAndSync(target, patch, title, introLines) {
        const config = await saveGuildAutomodConfig(this.client, target.guild.id, patch);
        await syncNativeRules(target.guild, config, getInvoker(target)?.username || "Unknown User");
        return this.respond(target, title, [
            ...introLines,
            ...this.describe(config),
        ]);
    }

    async applyState(target, enabled) {
        return this.saveAndSync(target, { enabled }, "Automod Updated", [
            `The shared automod suite is now **${enabled ? "enabled" : "disabled"}**.`,
        ]);
    }

    async applyAction(target, action) {
        if (!["delete", "timeout", "kick", "ban"].includes(action)) {
            return this.respond(target, "Automod Action", [
                "Choose one of: **delete**, **timeout**, **kick**, or **ban**.",
            ]);
        }

        return this.saveAndSync(target, { enabled: true, action }, "Automod Action Updated", [
            `Default enforcement action is now **${action}**.`,
        ]);
    }

    async applyLogs(target, channelId) {
        return this.saveAndSync(target, { logChannelId: channelId || null }, "Automod Logs Updated", [
            `Log channel is now **${channelId ? `<#${channelId}>` : "disabled"}**.`,
        ]);
    }

    async applyTimeoutDuration(target, minutes) {
        const safeMinutes = Math.max(1, Number(minutes) || 10);
        return this.saveAndSync(target, { timeoutDurationMs: safeMinutes * 60 * 1000 }, "Automod Timeout Updated", [
            `Timeout action length is now **${safeMinutes} minute(s)**.`,
        ]);
    }

    async run({ message, args }) {
        const action = args[0]?.toLowerCase() ?? "status";

        if (action === "enable") return this.applyState(message, true);
        if (action === "disable") return this.applyState(message, false);
        if (action === "action") return this.applyAction(message, args[1]?.toLowerCase());
        if (action === "logs") {
            const raw = args[1]?.toLowerCase();
            if (!raw || raw === "off" || raw === "disable" || raw === "none") {
                return this.applyLogs(message, null);
            }

            const channel =
                message.mentions.channels.first() ||
                message.guild.channels.cache.get(args[1]) ||
                null;

            if (!channel || !channel.isTextBased?.()) {
                return this.respond(message, "Automod Logs", [
                    "Mention a valid text channel, or use `off` to clear logs.",
                ]);
            }

            return this.applyLogs(message, channel.id);
        }
        if (action === "timeout") {
            return this.applyTimeoutDuration(message, args[1]);
        }

        const config = await getGuildAutomodConfig(this.client, message.guild.id);
        return this.respond(message, "Automod Status", [
            "These settings are shared between the bot commands and the Zenith dashboard.",
            ...this.describe(config),
        ]);
    }

    async exec({ interaction }) {
        const action = interaction.options.getSubcommand(false) ?? "status";
        if (action === "enable") return this.applyState(interaction, true);
        if (action === "disable") return this.applyState(interaction, false);
        if (action === "action") {
            return this.applyAction(interaction, interaction.options.getString("mode"));
        }
        if (action === "logs") {
            const disable = interaction.options.getBoolean("disable") || false;
            const channel = interaction.options.getChannel("channel");
            if (disable || !channel) {
                return this.applyLogs(interaction, null);
            }

            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread].includes(channel.type) && !channel.isTextBased?.()) {
                return this.respond(interaction, "Automod Logs", [
                    "Pick a valid text-based channel for AutoMod logs.",
                ]);
            }

            return this.applyLogs(interaction, channel.id);
        }
        if (action === "timeout") {
            return this.applyTimeoutDuration(interaction, interaction.options.getInteger("minutes"));
        }

        const config = await getGuildAutomodConfig(this.client, interaction.guild.id);
        return this.respond(interaction, "Automod Status", [
            "These settings are shared between the bot commands and the Zenith dashboard.",
            ...this.describe(config),
        ]);
    }
};
