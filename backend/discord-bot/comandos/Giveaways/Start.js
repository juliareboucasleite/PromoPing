const Command = require("../../abstract/command");
const {
    getActor,
    hasGiveawayAccess,
    normalizePrize,
    parseDuration,
    parseReaction,
    respond,
} = require("./_shared");

module.exports = class GiveawayStart extends Command {
    constructor(...args) {
        super(...args, {
            name: "gstart",
            aliases: ["giveawaystart"],
            description: "Start a giveaway campaign with validation for duration, winners, and reaction emoji.",
            category: "Giveaways",
            usage: ["gstart <time> <winners> <prize> [custom-emoji]"],
            userPerms: ["ViewChannel", "SendMessages"],
            botPerms: ["ViewChannel", "SendMessages", "AddReactions"],
            cooldown: 5,
            options: [
                { name: "time", description: "Giveaway duration", type: 3, required: true },
                { name: "winners", description: "Number of winners", type: 4, required: true },
                { name: "prize", description: "Prize name", type: 3, required: true },
                { name: "image", description: "Optional giveaway banner", type: 11, required: false },
                { name: "reaction", description: "Custom emoji to enter", type: 3, required: false },
            ],
        });
    }

    async perform(target, { time, winners, prize, reaction, image }) {
        const actor = getActor(target);
        if (!hasGiveawayAccess(this.client, target.member, target.guild)) {
            return respond(target, "Giveaway Access", [
                "You need `Manage Guild`, the server owner role, or a role named `giveaway`/`giveaways` to manage campaigns.",
            ]);
        }

        const duration = parseDuration(time);
        if (!duration || duration < 30_000) {
            return respond(target, "Giveaway Access", [
                "Provide a valid duration like `30s`, `10m`, `2h`, or `1d`.",
            ]);
        }

        if (!Number.isInteger(Number(winners)) || Number(winners) < 1 || Number(winners) > 20) {
            return respond(target, "Giveaway Access", [
                "Winner count must be a number between **1** and **20**.",
            ]);
        }

        const finalPrize = normalizePrize(prize);
        if (!finalPrize) {
            return respond(target, "Giveaway Access", ["Provide a prize name."]);
        }

        const emojiId = parseReaction(this.client, reaction);
        if (reaction && !emojiId) {
            return respond(target, "Giveaway Access", [
                "Giveaway reactions must be custom server emoji in `<:name:id>` format.",
            ]);
        }

        await this.client.giveawayManager.start(target.channel, {
            hoster: actor?.id,
            prize: finalPrize,
            winnerCount: Number(winners),
            duration,
            reaction: emojiId || this.client.config.Client.emoji.giveaway2,
            messages: {
                image: image || null,
            },
        });

        return respond(target, "Giveaway Started", [
            `Prize: **${finalPrize}**`,
            `Winners: **${Number(winners)}**`,
            `Duration: **${time}**`,
            `Channel: ${target.channel}`,
        ]);
    }

    async run({ message, args }) {
        const reactionArg = args.find((part, index) => index >= 2 && /^<a?:.+?:\d+>$/.test(part));
        const prize = args.slice(2).filter((part) => part !== reactionArg).join(" ");
        return this.perform(message, {
            time: args[0],
            winners: Number(args[1]),
            prize,
            reaction: reactionArg,
            image: message.attachments.first()?.url || null,
        });
    }

    async exec({ interaction }) {
        return this.perform(interaction, {
            time: interaction.options.getString("time"),
            winners: interaction.options.getInteger("winners"),
            prize: interaction.options.getString("prize"),
            reaction: interaction.options.getString("reaction"),
            image: interaction.options.getAttachment("image")?.url || null,
        });
    }
};
