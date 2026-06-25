import { InteractionType, InteractionResponseType, verifyKeyMiddleware } from "discord-interactions";
import { getDiscordPublicKey } from "../utils/discordSignature.js";
import { getLinkedRoleConnectionForDiscordUser } from "../services/discordLinkedRoles.js";

function createDiscordVerifyMiddleware() {
    const publicKey = getDiscordPublicKey();
    if (!publicKey) {
        console.error("[DISCORD-HTTP] PUBLIC_KEY ausente ao iniciar middleware");
        return (req, res) => {
            res.status(500).json({ error: "Discord public key not configured" });
        };
    }
    console.log("[DISCORD-HTTP] Middleware ativo, public key:", publicKey.slice(0, 8) + "...");
    return verifyKeyMiddleware(publicKey);
}

let discordVerifyMiddleware = null;

export function getDiscordVerifyMiddleware() {
    if (!discordVerifyMiddleware) {
        discordVerifyMiddleware = createDiscordVerifyMiddleware();
    }
    return discordVerifyMiddleware;
}

/**
 * Responde ao PING do Discord quando este URL estiver configurado no portal.
 * Não defina Interactions Endpoint URL se o bot discord.js tratar slash commands via Gateway.
 */
export function handleDiscordInteractionsAfterVerify(req, res) {
    console.warn(
        "[DISCORD-HTTP] Interação recebida em /api/interactions fora do PING. " +
        "Remova Interactions Endpoint URL no Developer Portal para usar o bot via Gateway."
    );
    return res.status(404).send("Interactions must be handled via Gateway bot");
}

/**
 * POST /verify-user — Linked Roles Verification URL
 * req.body já vem parseado pelo verifyKeyMiddleware
 */
export async function handleDiscordVerifyUser(req, res) {
    const body = req.body || {};

    const discordUserId = body.user_id || body.discord_user_id;
    if (!discordUserId) {
        return res.status(400).json({ error: "user_id em falta" });
    }

    try {
        const connection = await getLinkedRoleConnectionForDiscordUser(discordUserId);
        return res.status(200).json(connection);
    } catch (err) {
        console.error("[DISCORD-HTTP] /verify-user erro:", err);
        return res.status(500).json({ error: "Falha ao obter metadata" });
    }
}

export { getDiscordVerifyMiddleware as discordVerifyMiddleware, InteractionType, InteractionResponseType };
