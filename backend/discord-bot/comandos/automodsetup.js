const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    DEFAULT_AUTOMOD,
    saveGuildAutomodConfig,
    syncNativeRules,
} = require("../../../toolkit/helpers/automod-manager");
const { getInvoker } = require("../../../toolkit/helpers/moderation-security");

module.exports = class SetupAutoMod extends Command {
    constructor(...args) {
        super(...args, {
            name: "setupautomod",
            aliases: ["automodsetup", "amsetup"],
            description: "Provision the guarded automod suite with secure defaults.",
            usage: ["setupautomod"],
            category: "Moderation",
            userPerms: ["Administrator"],
            botPerms: ["ManageGuild", "ViewChannel", "SendMessages"],
            guildOnly: true,
        });
    }

    async respond(target, title, lines, ephemeral = true) {
        return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
    }

    async perform(target) {
        const config = await saveGuildAutomodConfig(this.client, target.guild.id, {
            ...DEFAULT_AUTOMOD,
            enabled: true,
            externalLinks: { ...DEFAULT_AUTOMOD.externalLinks, enabled: true },
        });
        await syncNativeRules(target.guild, config, getInvoker(target)?.username || "Unknown User");
        return this.respond(target, "Automod Provisioned", [
            "The guarded automod suite has been provisioned with secure defaults.",
            `Mass mention limit: **${config.massMention.limit}**`,
            `Spam threshold: **${config.spam.maxMessages} messages / ${config.spam.intervalMs / 1000}s**`,
            `Repeat threshold: **${config.repeatedMessages.threshold}** matching messages`,
        ]);
    }

    async run({ message }) {
        return this.perform(message);
    }

    async exec({ interaction }) {
        return this.perform(interaction);
    }
};
