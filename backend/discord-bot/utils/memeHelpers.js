const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const MEME_NEW_BUTTON_ID = 'meme_new_random';

function buildMemeEmbed(meme) {
    const caption = (meme?.description || '').trim();
    const embed = new EmbedBuilder()
        .setTitle('Random Meme')
        .setDescription(caption || 'Enjoy! Hit the button below for another one.')
        .setColor(0x57f287)
        .setFooter({ text: 'PromoPing • Memes • Click below for another meme' })
        .setTimestamp();

    if (meme?.url && !String(meme.type || '').includes('video')) {
        embed.setImage(meme.url);
    }

    return embed;
}

function buildMemeComponents() {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(MEME_NEW_BUTTON_ID)
                .setLabel('New Meme')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Success)
        ),
    ];
}

function buildMemeMessage(meme) {
    const isVideo = String(meme?.type || '').includes('video');
    const payload = {
        embeds: [buildMemeEmbed(meme)],
        components: buildMemeComponents(),
    };

    if (isVideo && meme?.url) {
        payload.content = meme.url;
    }

    return payload;
}

module.exports = {
    MEME_NEW_BUTTON_ID,
    buildMemeEmbed,
    buildMemeComponents,
    buildMemeMessage,
};
