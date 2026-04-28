const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    getGuildAutomodConfig,
    saveGuildAutomodConfig,
    syncNativeRules,
} = require("../../../toolkit/helpers/automod-manager");
const { getInvoker } = require("../../../toolkit/helpers/moderation-security");

module.exports = class AntiLink extends Command {
    constructor(...args) {
        super(...args, {
            name: "antilink",
            aliases: ["linkblock"],
            description: "Toggle external-link protection for the guarded automod suite.",
            usage: ["antilink <enable|disable|status>"],
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
            ],
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    async update(target, enabled) {
        const current = await getGuildAutomodConfig(this.client, target.guild.id);
        const next = await saveGuildAutomodConfig(this.client, target.guild.id, {
            enabled: true,
            inviteLinks: { ...current.inviteLinks, enabled },
            externalLinks: { ...current.externalLinks, enabled },
        });
        await syncNativeRules(target.guild, next, getInvoker(target)?.username || "Unknown User");
        return this.respond(target, "Link Shield", [
            `External link protection is now **${enabled ? "enabled" : "disabled"}**.`,
            `Invite protection: **${next.inviteLinks.enabled ? "On" : "Off"}**`,
            `External link protection: **${next.externalLinks.enabled ? "On" : "Off"}**`,
        ]);
    }

    async run({ message, args }) {
        const action = args[0]?.toLowerCase() ?? "status";
        if (action === "enable") return this.update(message, true);
        if (action === "disable") return this.update(message, false);
        const config = await getGuildAutomodConfig(this.client, message.guild.id);
        return this.respond(message, "Link Shield", [
            `Invite protection: **${config.inviteLinks.enabled ? "On" : "Off"}**`,
            `External link protection: **${config.externalLinks.enabled ? "On" : "Off"}**`,
        ]);
    }

    async exec({ interaction }) {
        return this.run({
            message: interaction,
            args: [interaction.options.getString("state")].filter(Boolean),
        });
    }
};
