const Command = require("../../abstract/command");
const { respond } = require("./_shared");

function parseSnowflake(id) {
    const timestamp = Math.floor(Number(id) / 4194304 + 1420070400000);
    return Math.floor(timestamp / 1000);
}

function formatDiff(first, second) {
    let seconds = Math.abs(first - second);
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    return [
        days ? `**${days}** day(s)` : null,
        hours ? `**${hours}** hour(s)` : null,
        minutes ? `**${minutes}** minute(s)` : null,
        `**${seconds.toFixed(0)}** second(s)`,
    ].filter(Boolean).join(", ");
}

module.exports = class Snowflake extends Command {
    constructor(...args) {
        super(...args, {
            name: "snowflake",
            aliases: ["timediff"],
            description: "Compare two Discord snowflakes and show the time gap between them.",
            category: "Giveaways",
            usage: ["snowflake <id1> <id2>"],
            userPerms: ["ViewChannel", "SendMessages"],
            botPerms: ["ViewChannel", "SendMessages"],
            cooldown: 5,
            options: [
                { name: "id1", description: "First snowflake", type: 3, required: true },
                { name: "id2", description: "Second snowflake", type: 3, required: true },
            ],
        });
    }

    async perform(target, firstId, secondId) {
        if (!/^\d+$/.test(firstId || "") || !/^\d+$/.test(secondId || "")) {
            return respond(target, "Snowflake", ["Both values must be valid Discord snowflakes."]);
        }

        const first = parseSnowflake(firstId);
        const second = parseSnowflake(secondId);
        return respond(target, "Snowflake", [
            `Difference: ${formatDiff(first, second)}`,
            `\`${firstId}\` -> <t:${first}:F>`,
            `\`${secondId}\` -> <t:${second}:F>`,
        ]);
    }

    async run({ message, args }) {
        return this.perform(message, args[0] || message.reference?.messageId, args[1]);
    }

    async exec({ interaction }) {
        return this.perform(interaction, interaction.options.getString("id1"), interaction.options.getString("id2"));
    }
};
