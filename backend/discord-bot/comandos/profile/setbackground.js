const fs = require("fs");
const Command = require("../../abstract/command");
const { TEMPLATE_MAP, ensureProfile, respond, templatePath } = require("./_shared");

module.exports = class SetBackgroundCommand extends Command {
    constructor(client) {
        super(client, "setbackground", {
            name: "setbackground",
            aliases: ["setbg", "background", "bg"],
            category: "Profile",
            description: "Set your profile background from bundled local templates.",
            usage: ["setbackground <name>", "setbackground list"],
            examples: ["setbackground galaxy", "setbackground list"],
            cooldown: 5,
            slash: false,
        });
    }

    async run({ message, args }) {
        const sub = (args[0] || "list").toLowerCase();
        if (sub === "list") {
            return respond(message, "Profile Backgrounds", [
                Object.keys(TEMPLATE_MAP).map((name) => `\`${name}\``).join(", "),
            ]);
        }

        if (!TEMPLATE_MAP[sub]) {
            return respond(message, "Profile Backgrounds", [
                "That background does not exist. Use `setbackground list` to view the available templates.",
            ]);
        }

        const filePath = templatePath(sub);
        if (!filePath || !fs.existsSync(filePath)) {
            return respond(message, "Profile Backgrounds", [
                "That background asset is missing from disk.",
            ]);
        }

        const profile = await ensureProfile(message.author.id);
        profile.backgroundKey = sub;
        profile.backgroundPath = filePath;
        await profile.save();

        return respond(message, "Profile Backgrounds", [
            `Background set to **${sub}**.`,
            "Use `profilecard` to render the updated card.",
        ]);
    }
};
