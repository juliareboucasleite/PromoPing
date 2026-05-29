import { verifyKey } from "discord-interactions";

export function getDiscordPublicKey() {
    return (process.env.DISCORD_PUBLIC_KEY || process.env.PUBLIC_KEY || "").trim();
}

/**
 * Verifica pedidos assinados pelo Discord (Interactions, Linked Roles, etc.)
 */
export async function verifyDiscordRequestFromHeaders(rawBody, headers) {
    const signature = headers["x-signature-ed25519"] || headers["X-Signature-Ed25519"];
    const timestamp = headers["x-signature-timestamp"] || headers["X-Signature-Timestamp"];
    const publicKey = getDiscordPublicKey();

    if (!rawBody || !signature || !timestamp || !publicKey) {
        return false;
    }

    try {
        return await verifyKey(rawBody, signature, timestamp, publicKey);
    } catch {
        return false;
    }
}
