const { buildNoticePanel, reply } = require("../../../toolkit/helpers/cv2");
const {
    sanitizeText,
    validateRoleOperation,
} = require("../../../toolkit/helpers/moderation-security");

function respond(target, title, lines, ephemeral = true) {
    return reply(target, buildNoticePanel({ title, lines }), { ephemeral });
}

async function getGuildProfile(client, guildId) {
    return client.database.guildData.get(guildId);
}

function normalizeWelcomeMessage(value, fallback) {
    return sanitizeText(value, {
        fallback,
        maxLength: 280,
        blockMassMentions: true,
    });
}

function validateAutoRole(client, context, role) {
    return validateRoleOperation({
        client,
        guild: context.guild,
        actorMember: context.member,
        role,
        action: "assign",
    });
}

module.exports = {
    getGuildProfile,
    normalizeWelcomeMessage,
    respond,
    validateAutoRole,
};
