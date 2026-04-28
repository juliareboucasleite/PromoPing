const Command = require("../../abstract/command");
const { hasGiveawayAccess, respond } = require("./_shared");

module.exports = class GiveawayList extends Command {
    constructor(...args) {
        super(...args, {
            name: "glist",
            aliases: ["giveawaylist"],
            description: "List active and ended giveaways in the current server.",
            category: "Giveaways",
            usage: ["glist"],
            userPerms: ["ViewChannel", "SendMessages"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message }) {
        if (!hasGiveawayAccess(this.client, message.member, message.guild)) {
            return respond(message, "Giveaway Access", ["You do not have permission to inspect giveaway campaigns."]);
        }

        const giveaways = this.client.giveawayManager.giveaways
            .filter((giveaway) => giveaway.guildId === message.guild.id)
            .slice(0, 20);

        if (!giveaways.length) {
            return respond(message, "Giveaways", ["There are no tracked giveaways in this server right now."]);
        }

        return respond(message, "Giveaways", giveaways.map((giveaway) =>
            `\`${giveaway.messageId}\` | **${giveaway.prize}** | ${giveaway.ended ? "Ended" : `Ends <t:${Math.floor(giveaway.endsAt / 1000)}:R>`}`
        ));
    }
};
