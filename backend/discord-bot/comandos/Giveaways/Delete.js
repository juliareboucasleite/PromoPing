const Command = require("../../abstract/command");
const { hasGiveawayAccess, resolveGiveaway, respond } = require("./_shared");

module.exports = class GiveawayDelete extends Command {
    constructor(...args) {
        super(...args, {
            name: "gdelete",
            aliases: ["giveawaydelete"],
            description: "Delete a giveaway and remove its tracked campaign record.",
            category: "Giveaways",
            usage: ["gdelete <message-id>"],
            userPerms: ["ViewChannel", "SendMessages", "ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            options: [{ name: "id", description: "Giveaway message id", type: 3, required: true }],
        });
    }

    async perform(target, id) {
        if (!hasGiveawayAccess(this.client, target.member, target.guild)) {
            return respond(target, "Giveaway Access", ["You do not have permission to delete giveaways."]);
        }
        const giveaway = resolveGiveaway(this.client.giveawayManager, id);
        if (!giveaway) return respond(target, "Giveaway Access", ["I could not find a giveaway with that id."]);

        await this.client.giveawayManager.delete(giveaway.messageId);
        return respond(target, "Giveaway Updated", [
            `Deleted giveaway **${giveaway.prize}**.`,
            `Message: \`${giveaway.messageId}\``,
        ]);
    }

    async run({ message, args }) {
        return this.perform(message, args[0]);
    }

    async exec({ interaction }) {
        return this.perform(interaction, interaction.options.getString("id"));
    }
};
