const Command = require("../../abstract/command");
const { hasGiveawayAccess, resolveGiveaway, respond } = require("./_shared");

module.exports = class GiveawayReroll extends Command {
    constructor(...args) {
        super(...args, {
            name: "greroll",
            aliases: ["giveawayreroll", "reroll"],
            description: "Reroll an ended giveaway and select fresh winners.",
            category: "Giveaways",
            usage: ["greroll <message-id>"],
            userPerms: ["ViewChannel", "SendMessages", "ManageGuild"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            options: [{ name: "id", description: "Giveaway message id", type: 3, required: true }],
        });
    }

    async perform(target, id) {
        if (!hasGiveawayAccess(this.client, target.member, target.guild)) {
            return respond(target, "Giveaway Access", ["You do not have permission to reroll giveaways."]);
        }
        const giveaway = resolveGiveaway(this.client.giveawayManager, id);
        if (!giveaway) return respond(target, "Giveaway Access", ["I could not find a giveaway with that id."]);
        if (!giveaway.ended) return respond(target, "Giveaway Access", ["That giveaway must be ended before it can be rerolled."]);

        await giveaway.reroll();
        return respond(target, "Giveaway Updated", [
            `Rerolled giveaway **${giveaway.prize}**.`,
            `New winners: ${giveaway.winners.length ? giveaway.winners.map((winner) => `<@${winner}>`).join(", ") : "None"}`,
        ]);
    }

    async run({ message, args }) {
        return this.perform(message, args[0] || message.reference?.messageId);
    }

    async exec({ interaction }) {
        return this.perform(interaction, interaction.options.getString("id"));
    }
};
