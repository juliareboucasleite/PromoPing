/**
 * Product storefront panels (buy + review) — SpotiCat by default.
 * Override via .env: PRODUCT_NAME, PRODUCT_SLUG, PRODUCT_PAYMENT_URL, PRODUCT_PRICE, PRODUCT_BANNER_URL
 */

const REVIEWER_ROLE_IDS = (
    process.env.PRODUCT_REVIEWER_ROLE_IDS ||
    '1514462155167105114,1514436077979566131'
)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const PRODUCT = {
    name: process.env.PRODUCT_NAME || 'SpotiCat',
    slug: (process.env.PRODUCT_SLUG || 'spotcat').toLowerCase().replace(/[^a-z0-9]/g, ''),
    paymentUrl: process.env.PRODUCT_PAYMENT_URL || 'https://checkout.revolut.com/pay/9b60e0bf-18bd-486a-9b88-74cb30b68c8a',
    price: process.env.PRODUCT_PRICE || '$5 USD',
    bannerUrl: process.env.PRODUCT_BANNER_URL || null,
    reviewerRoleIds: REVIEWER_ROLE_IDS,
};

function getProductChannelName(user) {
    const base = (user.username || user.displayName || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
    const name = `${PRODUCT.slug}-${base || 'user'}`;
    return name.substring(0, 100);
}

function memberCanReview(member) {
    if (!member) return false;
    return PRODUCT.reviewerRoleIds.some((id) => member.roles.cache.has(id));
}

function buildPurchaseWelcome(user) {
    return (
        `Welcome ${user}!\n\n` +
        `If you are purchasing **${PRODUCT.name}** (${PRODUCT.price}), follow these steps:\n\n` +
        `**1.** Pay via [Revolut Checkout](${PRODUCT.paymentUrl})\n` +
        `**2.** Send proof of payment in this channel (screenshot or receipt)\n` +
        `**3.** Wait for staff to verify and release your access\n\n` +
        'This helps us deliver your license faster. Thank you for your purchase.'
    );
}

function buildHelpWelcome() {
    return (
        'Please describe your issue clearly. Attach screenshots if needed.\n\n' +
        'Avoid opening duplicate tickets — staff will respond as soon as possible.'
    );
}

module.exports = {
    PRODUCT,
    getProductChannelName,
    memberCanReview,
    buildPurchaseWelcome,
    buildHelpWelcome,
};
