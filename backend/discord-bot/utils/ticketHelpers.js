const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
} = require('discord.js');
const {
    getStaffRoleIds,
    buildStaffMention,
    TICKET_CATEGORY_NAME,
    TICKET_PANEL_NAME,
    formatTicketDate,
} = require('../config/ticketConfig');

function buildTicketWelcomeEmbed({ user, panelName = TICKET_PANEL_NAME, category = 'General Support', extraDescription = null }) {
    const embed = new EmbedBuilder()
        .setTitle(panelName)
        .setDescription(
            extraDescription ||
            'Please wait a moment — our team will reach out to assist you as quickly as possible.'
        )
        .setColor(0xed4245)
        .setTimestamp()
        .setFooter({ text: `PromoPing | ${panelName}` });

    if (user) {
        embed.addFields(
            { name: 'Opened by', value: `${user}`, inline: true },
            { name: 'Category', value: category, inline: true }
        );
    }

    return embed;
}

function buildTicketActionRow(channelId, ownerId, claimedBy = null) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_fechar_${channelId}_${ownerId}`)
            .setLabel('Close')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🔒'),
        claimedBy
            ? new ButtonBuilder()
                .setCustomId(`ticket_release_${channelId}_${claimedBy}`)
                .setLabel('Release')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🙌')
            : new ButtonBuilder()
                .setCustomId(`ticket_claim_${channelId}_${ownerId}`)
                .setLabel('Claim')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🙌')
    );
    return row;
}

function buildTicketClosedDmEmbed({ guildName, openedAt, panelName, channelName, closedBy, closedAt, reason }) {
    return new EmbedBuilder()
        .setTitle('Ticket closed')
        .setDescription(`Your ticket was closed in **${guildName}**.`)
        .setColor(0xed4245)
        .addFields(
            {
                name: 'Ticket information',
                value: [
                    `**Opened:** ${formatTicketDate(openedAt)}`,
                    `**Panel:** ${panelName}`,
                    `**Ticket name:** ${channelName}`,
                ].join('\n'),
                inline: false,
            },
            {
                name: 'Closing information',
                value: [
                    `**Closed by:** ${closedBy}`,
                    `**Closed at:** ${formatTicketDate(closedAt)}`,
                    `**Reason:** ${reason || 'No reason provided'}`,
                ].join('\n'),
                inline: false,
            }
        )
        .setTimestamp()
        .setFooter({ text: 'If you have more questions, you can open a new ticket. | PromoPing' });
}

async function ensureTicketCategory(guild) {
    let category = guild.channels.cache.find(
        (cat) => cat.name === TICKET_CATEGORY_NAME && cat.type === ChannelType.GuildCategory
    );

    if (!category) {
        category = await guild.channels.create({
            name: TICKET_CATEGORY_NAME,
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
            ],
        });
    }

    return category;
}

async function applyStaffPermissions(ticketChannel) {
    for (const roleId of getStaffRoleIds()) {
        try {
            await ticketChannel.permissionOverwrites.edit(roleId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
                AttachFiles: true,
                EmbedLinks: true,
                ManageMessages: true,
            });
        } catch (error) {
            console.warn(`[DISCORD] Could not set permissions for role ${roleId}:`, error.message);
        }
    }
}

async function createTicketChannel(guild, botUserId, ownerId, channelName) {
    const ticketCategory = await ensureTicketCategory(guild);

    const permissionOverwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
        },
        {
            id: ownerId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
        {
            id: botUserId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ManageChannels,
            ],
        },
    ];

    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategory.id,
        topic: `promoping-ticket:${ownerId}`,
        permissionOverwrites,
    });

    await applyStaffPermissions(ticketChannel);

    try {
        await ticketChannel.permissionOverwrites.edit(ownerId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
        });
    } catch (error) {
        console.error('[DISCORD] Error updating user ticket permissions:', error);
    }

    return ticketChannel;
}

function getTicketChannelName(user, prefix = 'ticket') {
    const base = (user.username || user.displayName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
    const safePrefix = String(prefix || 'ticket').toLowerCase().replace(/[^a-z0-9]/g, '') || 'ticket';
    return `${safePrefix}-${base || 'user'}`.substring(0, 100);
}

function isTicketChannel(channel) {
    if (!channel?.name) return false;
    const name = channel.name.toLowerCase();
    return name.startsWith('ticket-') || /^[a-z0-9]+-[a-z0-9_]+$/.test(name);
}

module.exports = {
    buildTicketWelcomeEmbed,
    buildTicketActionRow,
    buildTicketClosedDmEmbed,
    buildStaffMention,
    ensureTicketCategory,
    applyStaffPermissions,
    createTicketChannel,
    getTicketChannelName,
    isTicketChannel,
    TICKET_PANEL_NAME,
};
