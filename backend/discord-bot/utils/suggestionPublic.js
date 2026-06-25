const crypto = require('crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function generatePublicId() {
    return crypto.randomBytes(4).toString('hex');
}

function formatPlatform(plataforma) {
    if (plataforma === 'site') return 'Website';
    if (plataforma === 'bot') return 'Discord Bot';
    return 'Website & Bot';
}

function buildPublicSuggestionEmbed({
    submitterName,
    submitterAvatar,
    titulo,
    descricao,
    plataforma,
    upvotes = 0,
    downvotes = 0,
    submitterId,
    publicId,
}) {
    const suggestionText = `**${titulo}**\n${descricao}`.substring(0, 1024);

    return new EmbedBuilder()
        .setAuthor({ name: 'Suggestions', iconURL: submitterAvatar || undefined })
        .addFields(
            { name: 'Submitter', value: submitterName, inline: true },
            { name: 'Platform', value: formatPlatform(plataforma), inline: true },
            { name: 'Suggestion', value: suggestionText || titulo, inline: false },
            {
                name: 'Results so far',
                value: `✅ : ${upvotes}\n❌ : ${downvotes}`,
                inline: false,
            }
        )
        .setColor(0xfee75c)
        .setThumbnail(submitterAvatar || null)
        .setTimestamp()
        .setFooter({ text: `User ID: ${submitterId} | sID: ${publicId}` });
}

/**
 * @param {number} suggestionDbId
 * @param {{ guildId?: string, threadId?: string|null }} options
 */
function buildVoteRow(suggestionDbId, options = {}) {
    const { guildId, threadId } = options;

    const buttons = [
        new ButtonBuilder()
            .setCustomId(`suggestion_vote_up_${suggestionDbId}`)
            .setLabel('Upvote')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('✅'),
        new ButtonBuilder()
            .setCustomId(`suggestion_vote_down_${suggestionDbId}`)
            .setLabel('Downvote')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌'),
    ];

    if (threadId && guildId) {
        buttons.push(
            new ButtonBuilder()
                .setLabel('Discuss')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${guildId}/${threadId}`)
                .setEmoji('💬')
        );
    } else {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`suggestion_discuss_${suggestionDbId}`)
                .setLabel('Discuss')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('💬')
        );
    }

    return new ActionRowBuilder().addComponents(buttons);
}

async function resolveSuggestionsChannel(guild, client) {
    const channelId = process.env.DISCORD_SUGGESTIONS_PUBLIC_CHANNEL_ID;
    if (channelId) {
        const ch = await client.channels.fetch(channelId).catch(() => null);
        if (ch?.isTextBased?.()) return ch;
    }

    const names = ['suggestions', 'sugestoes', 'sugestões', 'suggestion'];
    return guild.channels.cache.find(
        (ch) => ch.isTextBased?.() && names.includes(ch.name.toLowerCase().replace(/[^a-z]/g, ''))
    ) || guild.channels.cache.find(
        (ch) => ch.isTextBased?.() && ch.name.toLowerCase().includes('suggest')
    );
}

async function resolveSuggestionsPanelChannel(guild, client) {
    const channelId = process.env.DISCORD_SUGGESTIONS_PANEL_CHANNEL_ID;
    if (!channelId) return null;
    const ch = await client.channels.fetch(channelId).catch(() => null);
    return ch?.isTextBased?.() ? ch : null;
}

module.exports = {
    generatePublicId,
    formatPlatform,
    buildPublicSuggestionEmbed,
    buildVoteRow,
    resolveSuggestionsChannel,
    resolveSuggestionsPanelChannel,
};
