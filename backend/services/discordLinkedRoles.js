import { pool } from "../database/db.js";

const PLAN_TIERS = {
    Free: 0,
    Basic: 1,
    Standard: 2,
    Premium: 3,
};

/**
 * Metadata exposta ao Discord para Linked Roles.
 * Chaves devem coincidir com o registo em setup-discord-linked-roles.js
 */
export async function getLinkedRoleConnectionForDiscordUser(discordUserId) {
    const [rows] = await pool.query(
        `SELECT
            u.ReferenciaID,
            u.Nome,
            u.Email,
            p.Nome AS plano_nome,
            cc.Conectado AS discord_conta_ligada
         FROM utilizadores u
         LEFT JOIN configutilizador c ON c.ReferenciaID = u.ReferenciaID
         LEFT JOIN planos p ON p.Id = c.PlanoAtualId
         LEFT JOIN contasconectadas cc
            ON cc.ReferenciaID = u.ReferenciaID AND cc.Tipo = 'discord'
         WHERE u.discord_id = ?
         LIMIT 1`,
        [String(discordUserId)]
    );

    if (!rows || rows.length === 0) {
        return {
            platform_name: "PromoPing",
            platform_username: null,
            metadata: {
                has_account: "0",
                is_premium: "0",
                plan_tier: "0",
            },
        };
    }

    const user = rows[0];
    const planName = user.plano_nome || "Free";
    const planTier = PLAN_TIERS[planName] ?? 0;
    const isPremium = planTier >= 2 ? "1" : "0";

    return {
        platform_name: "PromoPing",
        platform_username: user.Nome || user.Email || user.ReferenciaID,
        metadata: {
            has_account: "1",
            is_premium: isPremium,
            plan_tier: String(planTier),
        },
    };
}

export const LINKED_ROLE_METADATA_DEFINITIONS = [
    {
        key: "has_account",
        name: "Conta PromoPing",
        description: "Conta PromoPing ligada ao Discord",
        type: 7,
    },
    {
        key: "is_premium",
        name: "Plano Premium/Standard",
        description: "Plano Standard ou Premium ativo",
        type: 7,
    },
    {
        key: "plan_tier",
        name: "Nível do plano",
        description: "0=Free, 1=Basic, 2=Standard, 3=Premium",
        type: 3,
    },
];
