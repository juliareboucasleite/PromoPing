const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    getGuildAutomodConfig,
    saveGuildAutomodConfig,
    syncNativeRules,
} = require("../../../toolkit/helpers/automod-manager");
const { getInvoker } = require("../../../toolkit/helpers/moderation-security");

module.exports = class AntiMention extends Command {
    constructor(...args) {
        super(...args, {
            name: "antimention",
            aliases: ["mentionblock"],
            description: "Toggle and inspect mass-mention protection for the guarded automod suite.",
            usage: ["antimention <enable|disable|status> [limit]"],
            category: "Moderation",
            userPerms: ["Administrator"],
            botPerms: ["ManageGuild", "ViewChannel", "SendMessages"],
            guildOnly: true,
            options: [
                {
                    type: 3,
                    name: "state",
                    description: "enable, disable, or status",
                    required: false,
                    choices: [
                        { name: "enable", value: "enable" },
                        { name: "disable", value: "disable" },
                        { name: "status", value: "status" },
                    ],
                },
                {
                    type: 4,
                    name: "limit",
                    description: "Allowed mentions before automod triggers",
                    required: false,
                },
            ],
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    async apply(target, enabled, limit) {
        const current = await getGuildAutomodConfig(this.client, target.guild.id);
        const next = await saveGuildAutomodConfig(this.client, target.guild.id, {
            enabled: true,
            massMention: {
                ...current.massMention,
                enabled,
                limit: Math.max(3, Number(limit) || current.massMention.limit),
            },
        });
        await syncNativeRules(target.guild, next, getInvoker(target)?.username || "Unknown User");
        return this.respond(target, "Mention Shield", [
            `Mass mention protection is now **${enabled ? "enabled" : "disabled"}**.`,
            `Limit: **${next.massMention.limit}** mentions`,
            `Blocks @everyone/@here: **${next.massMention.blockEveryone ? "Yes" : "No"}**`,
        ]);
    }

    async run({ message, args }) {
        const action = args[0]?.toLowerCase() ?? "status";
        if (action === "enable") return this.apply(message, true, args[1]);
        if (action === "disable") return this.apply(message, false, args[1]);
        const config = await getGuildAutomodConfig(this.client, message.guild.id);
        return this.respond(message, "Mention Shield", [
            `Enabled: **${config.massMention.enabled ? "Yes" : "No"}**`,
            `Limit: **${config.massMention.limit}** mentions`,
            `Blocks @everyone/@here: **${config.massMention.blockEveryone ? "Yes" : "No"}**`,
        ]);
    }

    async exec({ interaction }) {
        const state = interaction.options.getString("state");
        const limit = interaction.options.getInteger("limit");
        return this.run({
            message: interaction,
            args: [state, limit].filter((value) => value !== null && value !== undefined),
        });
    }
};
