const { AttachmentBuilder } = require("discord.js");
const Canvas = require("@napi-rs/canvas");
const fs = require("fs");
const Command = require("../../abstract/command");
const { TEMPLATE_MAP, cleanBio, ensureProfile, imageRoot } = require("./_shared");

module.exports = class ProfileCardCommand extends Command {
    constructor(client) {
        super(client, "profilecard", {
            name: "profilecard",
            aliases: ["pc"],
            description: "Render a cleaner profile card with bio and cosmetic background.",
            category: "Profile",
            cooldown: 5,
            usage: ["profilecard [@user]"],
            examples: ["profilecard", "profilecard @PogyClient"],
            slash: false,
        });
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
        const words = text.split(" ");
        let line = "";
        let drawn = 0;
        for (let index = 0; index < words.length; index += 1) {
            const testLine = `${line}${words[index]} `;
            const width = ctx.measureText(testLine).width;
            if (width > maxWidth && index > 0) {
                ctx.fillText(line.trim(), x, y);
                line = `${words[index]} `;
                y += lineHeight;
                drawn += 1;
                if (drawn >= maxLines - 1) break;
            } else {
                line = testLine;
            }
        }
        if (line) ctx.fillText(line.trim(), x, y);
    }

    async run({ message }) {
        const user = message.mentions.users.first() || message.author;
        const profile = await ensureProfile(user.id);

        const canvas = Canvas.createCanvas(960, 420);
        const ctx = canvas.getContext("2d");

        let backgroundPath = profile.backgroundPath;
        if (!backgroundPath && profile.backgroundKey && TEMPLATE_MAP[profile.backgroundKey]) {
            backgroundPath = `${imageRoot()}\\${TEMPLATE_MAP[profile.backgroundKey]}`;
        }
        if (!backgroundPath || !fs.existsSync(backgroundPath)) {
            backgroundPath = `${imageRoot()}\\${TEMPLATE_MAP.galaxy}`;
        }

        if (backgroundPath && fs.existsSync(backgroundPath)) {
            const background = await Canvas.loadImage(backgroundPath);
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = "#10151d";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.fillStyle = "rgba(7, 10, 14, 0.58)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(38, 38, canvas.width - 76, canvas.height - 76);

        const avatar = await Canvas.loadImage(user.displayAvatarURL({ extension: "png", size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(180, 210, 96, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 84, 114, 192, 192);
        ctx.restore();

        ctx.strokeStyle = "rgba(255,255,255,0.65)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(180, 210, 100, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 34px Sans";
        ctx.fillText(user.username, 330, 110);

        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "22px Sans";
        ctx.fillText(`User ID: ${user.id}`, 330, 145);

        ctx.fillStyle = "#d8e0ea";
        ctx.font = "25px Sans";
        this.wrapText(ctx, cleanBio(profile.bio), 330, 205, 540, 32);

        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "20px Sans";
        ctx.fillText(
            `Background: ${profile.backgroundKey || "default"}  |  Badges: ${profile.badges?.length || 0}`,
            330,
            340
        );

        const buffer = canvas.toBuffer("image/png");
        const attachment = new AttachmentBuilder(buffer, { name: "profile-card.png" });
        return message.reply({ files: [attachment], allowedMentions: { parse: [] } });
    }
};
