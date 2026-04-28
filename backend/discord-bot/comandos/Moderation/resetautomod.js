const Command = require("../../abstract/command");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    DEFAULT_AUTOMOD,
    RULE_PREFIX,
    saveGuildAutomodConfig,
} = require("../../../toolkit/helpers/automod-manager");
const { getInvoker } = require("../../../toolkit/helpers/moderation-security");

module.exports = class ResetAutoMod extends Command {
    constructor(...args) {
        super(...args, {
            name: "resetautomod",
            aliases: ["automodreset", "amreset"],
            description: "Reset guarded automod settings and remove the bot-managed native rules.",
            usage: ["resetautomod"],
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
        const invoker = getInvoker(target);
        const rules = await target.guild.autoModerationRules.fetch().catch(() => null);
        if (rules) {
            for (const rule of rules.values()) {
                if (rule.name.startsWith(RULE_PREFIX)) {
                    await rule.delete(`Reset by ${invoker?.tag || invoker?.username || "Unknown User"}`).catch(() => {});
                }
            }
        }

        await saveGuildAutomodConfig(this.client, target.guild.id, DEFAULT_AUTOMOD);
        return this.respond(target, "Automod Reset", [
            "The guarded automod settings were reset to defaults and bot-managed native rules were removed.",
        ]);
    }

    async run({ message }) {
        return this.perform(message);
    }

    async exec({ interaction }) {
        return this.perform(interaction);
    }
};
