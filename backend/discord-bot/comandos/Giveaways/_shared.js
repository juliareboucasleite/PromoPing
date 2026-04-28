const ms = require("ms");
const { parseEmoji } = require("discord.js");
const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const { sanitizeText } = require("../../../toolkit/helpers/moderation-security");

function hasGiveawayAccess(client, member, guild) {
    return Boolean(
        member?.permissions?.has("ManageGuild") ||
        member?.roles?.cache?.some((role) => ["giveaway", "giveaways"].includes(role.name.toLowerCase())) ||
        guild?.ownerId === member?.id ||
        client.util.checkOwner(member?.id)
    );
}

function getActor(target) {
    return target?.user || target?.author || null;
}

function respond(target, title, lines, ephemeral = true) {
    return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

function normalizePrize(input) {
    return sanitizeText(String(input || "").replace(/<a?:.+?:\d+>/g, ""), {
        fallback: "",
        maxLength: 180,
    });
}

function parseReaction(client, input) {
    const raw = input || client.config.Client.emoji.giveaway2;
    const emoji = parseEmoji(raw);
    return emoji?.id ? emoji.id : null;
}

function parseDuration(input) {
    if (!input) return null;
    const value = ms(input);
    if (!value || Number.isNaN(value)) return null;
    return value;
}

function resolveGiveaway(manager, id) {
    if (!id) return null;
    return manager.giveaways.find((giveaway) => giveaway.messageId === id || giveaway.id === id) ?? null;
}

module.exports = {
    getActor,
    hasGiveawayAccess,
    normalizePrize,
    parseDuration,
    parseReaction,
    resolveGiveaway,
    respond,
};
