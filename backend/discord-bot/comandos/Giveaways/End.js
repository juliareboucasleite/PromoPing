const Command = require("../../abstract/command");
const { hasGiveawayAccess, resolveGiveaway, respond } = require("./_shared");

module.exports = class GiveawayEnd extends Command {
    constructor(...args) {
        super(...args, {
            name: "gend",
            aliases: ["giveawayend"],
            description: "End an active giveaway campaign.",
            category: "Giveaways",
            usage: ["gend <message-id>"],
            userPerms: ["ViewChannel", "SendMessages", "ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            options: [{ name: "id", description: "Giveaway message id", type: 3, required: true }],
        });
    }

    async perform(target, id) {
        if (!hasGiveawayAccess(this.client, target.member, target.guild)) {
            return respond(target, "Giveaway Access", ["You do not have permission to end giveaways."]);
        }
        const giveaway = resolveGiveaway(this.client.giveawayManager, id);
        if (!giveaway) return respond(target, "Giveaway Access", ["I could not find a giveaway with that id."]);
        if (giveaway.ended) return respond(target, "Giveaway Access", ["That giveaway has already ended."]);

        await giveaway.end();
        return respond(target, "Giveaway Updated", [
            `Ended giveaway **${giveaway.prize}**.`,
            `Message: \`${giveaway.messageId}\``,
        ]);
    }

    async run({ message, args }) {
        return this.perform(message, args[0] || message.reference?.messageId);
    }

    async exec({ interaction }) {
        return this.perform(interaction, interaction.options.getString("id"));
    }
};
