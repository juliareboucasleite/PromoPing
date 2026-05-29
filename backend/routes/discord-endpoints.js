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
 * Após verifyKeyMiddleware: PING já foi respondido; outros tipos vão para o Gateway.
 */
export function handleDiscordInteractionsAfterVerify(req, res) {
    return res.status(404).send("Handled via Gateway");
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
