/**
 * PromoPing support role hierarchy and ticket defaults.
 */

const SUPPORT_ROLES = {
    PromoPingSuporter: '1442655668904398980',
    Helpers: '1460655734600630354',
    Staff: '1454133429858730005',
    Supervisors: '1460655975034781706',
    SupervisorLead: '1460656005363798119',
};

const DEFAULT_SUPPORT_ROLE_IDS = Object.values(SUPPORT_ROLES);
const PRIMARY_SUPPORT_ROLE_ID = SUPPORT_ROLES.PromoPingSuporter;

function getStaffRoleIds() {
    const fromEnv = process.env.DISCORD_SUPPORT_ROLE_IDS;
    if (fromEnv) {
        return fromEnv.split(',').map((s) => s.trim()).filter(Boolean);
    }
    const single = process.env.DISCORD_SUPPORT_ROLE_ID;
    if (single) {
        const ids = new Set([single.trim(), ...DEFAULT_SUPPORT_ROLE_IDS]);
        return [...ids];
    }
    return [...DEFAULT_SUPPORT_ROLE_IDS];
}

function buildStaffMention() {
    return getStaffRoleIds().map((id) => `<@&${id}>`).join(' ');
}

function memberHasStaffRole(member) {
    if (!member) return false;
    return getStaffRoleIds().some((id) => member.roles.cache.has(id));
}

function formatTicketDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

module.exports = {
    SUPPORT_ROLES,
    DEFAULT_SUPPORT_ROLE_IDS,
    PRIMARY_SUPPORT_ROLE_ID,
    getStaffRoleIds,
    buildStaffMention,
    memberHasStaffRole,
    formatTicketDate,
    TICKET_CATEGORY_NAME: 'Tickets',
    TICKET_PANEL_NAME: 'Support & Help',
};
