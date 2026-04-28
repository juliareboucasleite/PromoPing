const Command = require("../../abstract/command");
const { TEMPLATE_MAP, respond } = require("./_shared");

module.exports = class ProfileBackgroundsCommand extends Command {
    constructor(client) {
        super(client, "backgrounds", {
            name: "backgrounds",
            aliases: ["bgs", "profilebackgrounds"],
            category: "Profile",
            description: "List available bundled profile background templates.",
            usage: ["backgrounds"],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message }) {
        return respond(message, "Profile Backgrounds", [
            Object.keys(TEMPLATE_MAP).map((name) => `\`${name}\``).join(", "),
            "Set one with `setbackground <name>`.",
        ]);
    }
};
