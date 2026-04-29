import { Router } from "express";
import crypto from "crypto";
import { verifyToken } from "../middleware/auth.js";
import { pool } from "../database/db.js";

const router = Router();

const DISCORD_API = "https://discord.com/api/v10";
const SCOPE_IDENTIFY = "identify guilds";
const SCOPE_BOT = "bot applications.commands";
const STATE_TTL_MS = 10 * 60 * 1000;

function getConfig() {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const callbackUrl = process.env.DISCORD_PANEL_CALLBACK_URL || `${baseUrl}/api/discord/panel/callback`;
    const botCallbackUrl = process.env.DISCORD_PANEL_BOT_CALLBACK_URL || `${baseUrl}/api/discord/panel/bot-callback`;
    const botPermissions = process.env.DISCORD_BOT_INVITE_PERMS || "274877975552"; // send msgs, embeds, attach files, manage webhooks
    return { clientId, clientSecret, callbackUrl, botCallbackUrl, botPermissions };
}

function signState(referenciaId, kind) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET ausente");
    const ts = Date.now();
    const payload = `${referenciaId}|${kind}|${ts}`;
    const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return Buffer.from(`${payload}|${hmac}`).toString("base64url");
}

function verifyState(state) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET ausente");
    let decoded;
    try {
        decoded = Buffer.from(state, "base64url").toString("utf8");
    } catch {
        return null;
    }
    const parts = decoded.split("|");
    if (parts.length !== 4) return null;
    const [referenciaId, kind, ts, hmac] = parts;
    const expected = crypto.createHmac("sha256", secret).update(`${referenciaId}|${kind}|${ts}`).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac, "hex"), Buffer.from(expected, "hex"))) return null;
    if (Date.now() - Number(ts) > STATE_TTL_MS) return null;
    return { referenciaId, kind };
}

async function discordTokenExchange(code, redirectUri) {
    const { clientId, clientSecret } = getConfig();
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
    });
    const r = await fetch(`${DISCORD_API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!r.ok) {
        const text = await r.text();
        throw new Error(`Discord token exchange falhou: ${r.status} ${text}`);
    }
    return r.json();
}

async function discordFetchUser(accessToken) {
    const r = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`Discord /users/@me falhou: ${r.status}`);
    return r.json();
}

// GET /api/discord/panel/connect — gera URL OAuth para ligar conta Discord
router.get("/connect", verifyToken, (req, res) => {
    try {
        const { clientId, callbackUrl } = getConfig();
        if (!clientId) return res.status(500).json({ error: "DISCORD_CLIENT_ID não configurado" });
        const state = signState(req.user.ReferenciaID, "link");
        const url = new URL(`${DISCORD_API}/oauth2/authorize`);
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackUrl);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", SCOPE_IDENTIFY);
        url.searchParams.set("state", state);
        url.searchParams.set("prompt", "consent");
        res.json({ url: url.toString() });
    } catch (err) {
        console.error("[DISCORD-PANEL] /connect erro:", err);
        res.status(500).json({ error: "Falha ao gerar URL OAuth" });
    }
});

// GET /api/discord/panel/callback — Discord redireciona aqui com ?code&state
router.get("/callback", async (req, res) => {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`/painel-suporte-corporacao/pages_corporation/discord.html?error=${encodeURIComponent(oauthError)}`);
    if (!code || !state) return res.status(400).send("code/state em falta");

    const verified = verifyState(state);
    if (!verified || verified.kind !== "link") return res.status(400).send("State inválido ou expirado");

    try {
        const { callbackUrl } = getConfig();
        const tokens = await discordTokenExchange(code, callbackUrl);
        const user = await discordFetchUser(tokens.access_token);

        const expiresAt = new Date(Date.now() + (tokens.expires_in || 0) * 1000);

        await pool.query(
            `INSERT INTO discord_panel_oauth_tokens
                (ReferenciaID, discord_user_id, discord_username, discord_avatar, access_token, refresh_token, expires_at, scope, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT (ReferenciaID) DO UPDATE SET
                discord_user_id = EXCLUDED.discord_user_id,
                discord_username = EXCLUDED.discord_username,
                discord_avatar = EXCLUDED.discord_avatar,
                access_token = EXCLUDED.access_token,
                refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                scope = EXCLUDED.scope,
                updated_at = CURRENT_TIMESTAMP`,
            [
                verified.referenciaId,
                user.id,
                user.username,
                user.avatar,
                tokens.access_token,
                tokens.refresh_token || null,
                expiresAt,
                tokens.scope || SCOPE_IDENTIFY,
            ]
        );

        await pool.query(
            "UPDATE Utilizadores SET discord_id = ? WHERE ReferenciaID = ? AND (discord_id IS NULL OR discord_id = '')",
            [user.id, verified.referenciaId]
        );

        return res.redirect("/painel-suporte-corporacao/pages_corporation/discord.html?linked=1");
    } catch (err) {
        console.error("[DISCORD-PANEL] /callback erro:", err);
        return res.redirect(`/painel-suporte-corporacao/pages_corporation/discord.html?error=${encodeURIComponent("oauth_failed")}`);
    }
});

// GET /api/discord/panel/status — retorna se está ligado e info do user Discord
router.get("/status", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT discord_user_id, discord_username, discord_avatar, expires_at, scope
             FROM discord_panel_oauth_tokens WHERE ReferenciaID = ? LIMIT 1`,
            [req.user.ReferenciaID]
        );
        if (!rows || rows.length === 0) return res.json({ connected: false });
        const r = rows[0];
        res.json({
            connected: true,
            discord_user_id: r.discord_user_id,
            username: r.discord_username,
            avatar: r.discord_avatar,
            avatar_url: r.discord_avatar
                ? `https://cdn.discordapp.com/avatars/${r.discord_user_id}/${r.discord_avatar}.png`
                : null,
            expires_at: r.expires_at,
            scope: r.scope,
        });
    } catch (err) {
        console.error("[DISCORD-PANEL] /status erro:", err);
        res.status(500).json({ error: "Falha ao obter estado" });
    }
});

// POST /api/discord/panel/disconnect — remove ligação Discord do user
router.post("/disconnect", verifyToken, async (req, res) => {
    try {
        await pool.query(
            "DELETE FROM discord_panel_oauth_tokens WHERE ReferenciaID = ?",
            [req.user.ReferenciaID]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error("[DISCORD-PANEL] /disconnect erro:", err);
        res.status(500).json({ error: "Falha ao desligar" });
    }
});

// GET /api/discord/panel/bot-invite — gera URL para adicionar bot a um servidor
router.get("/bot-invite", verifyToken, (req, res) => {
    try {
        const { clientId, botCallbackUrl, botPermissions } = getConfig();
        if (!clientId) return res.status(500).json({ error: "DISCORD_CLIENT_ID não configurado" });
        const state = signState(req.user.ReferenciaID, "bot");
        const url = new URL(`${DISCORD_API}/oauth2/authorize`);
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", botCallbackUrl);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", SCOPE_BOT);
        url.searchParams.set("permissions", botPermissions);
        url.searchParams.set("state", state);
        res.json({ url: url.toString() });
    } catch (err) {
        console.error("[DISCORD-PANEL] /bot-invite erro:", err);
        res.status(500).json({ error: "Falha ao gerar URL" });
    }
});

// GET /api/discord/panel/bot-callback — Discord redireciona após adicionar bot
router.get("/bot-callback", async (req, res) => {
    const { state, guild_id, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`/painel-suporte-corporacao/pages_corporation/discord.html?error=${encodeURIComponent(oauthError)}`);
    if (!state || !guild_id) return res.status(400).send("state/guild_id em falta");

    const verified = verifyState(state);
    if (!verified || verified.kind !== "bot") return res.status(400).send("State inválido");

    try {
        await pool.query(
            `INSERT INTO corporation_discord_guilds (guild_id, added_by_referenciaid, added_at, removed_at)
             VALUES (?, ?, CURRENT_TIMESTAMP, NULL)
             ON CONFLICT (guild_id) DO UPDATE SET
                added_by_referenciaid = EXCLUDED.added_by_referenciaid,
                added_at = CURRENT_TIMESTAMP,
                removed_at = NULL`,
            [guild_id, verified.referenciaId]
        );
        return res.redirect("/painel-suporte-corporacao/pages_corporation/discord.html?bot_added=1");
    } catch (err) {
        console.error("[DISCORD-PANEL] /bot-callback erro:", err);
        return res.redirect(`/painel-suporte-corporacao/pages_corporation/discord.html?error=${encodeURIComponent("bot_install_failed")}`);
    }
});

export default router;
