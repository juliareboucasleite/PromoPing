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

async function discordFetchUserGuilds(accessToken) {
    const r = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) throw new Error(`Discord /users/@me/guilds falhou: ${r.status}`);
    return r.json();
}

async function discordBotFetchChannels(guildId) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) throw new Error("DISCORD_BOT_TOKEN ausente");
    const r = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${botToken}` },
    });
    if (!r.ok) throw new Error(`Discord /guilds/${guildId}/channels falhou: ${r.status}`);
    return r.json();
}

async function getUserAccessToken(referenciaId) {
    const [rows] = await pool.query(
        `SELECT access_token, expires_at FROM discord_panel_oauth_tokens WHERE referenciaid = ? LIMIT 1`,
        [referenciaId]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0].access_token;
}

async function getUserPerfilId(referenciaId) {
    if (!referenciaId) return null;

    const [rows] = await pool.query(
        `SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ? LIMIT 1`,
        [referenciaId]
    );

    if (!rows || rows.length === 0) return null;
    return rows[0].PerfilId ?? rows[0].perfilid ?? null;
}

async function getRequestPerfilId(req) {
    const tokenPerfilId = req.user?.perfilId ?? req.user?.PerfilId;
    if (tokenPerfilId !== undefined && tokenPerfilId !== null) {
        return Number(tokenPerfilId);
    }

    return getUserPerfilId(req.user?.ReferenciaID);
}

async function ensureDiscordCouponTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_coupon_requests (
            id SERIAL PRIMARY KEY,
            requested_by_referenciaid VARCHAR(13) NOT NULL,
            target_guild_id VARCHAR(25) NOT NULL,
            target_channel_id VARCHAR(25) NOT NULL,
            title VARCHAR(256) NULL,
            description TEXT NULL,
            color INTEGER NULL,
            image_url TEXT NULL,
            button_label VARCHAR(80) NULL,
            button_url TEXT NULL,
            coupon_code VARCHAR(64) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            review_note TEXT NULL,
            reviewed_by_referenciaid VARCHAR(13) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP NULL
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_status
            ON discord_coupon_requests (status)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_created_at
            ON discord_coupon_requests (created_at)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_requested_by
            ON discord_coupon_requests (requested_by_referenciaid)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_coupon_messages (
            id SERIAL PRIMARY KEY,
            sent_by_referenciaid VARCHAR(13) NOT NULL,
            guild_id VARCHAR(25) NOT NULL,
            channel_id VARCHAR(25) NOT NULL,
            title VARCHAR(256) NULL,
            description TEXT NULL,
            color INTEGER NULL,
            image_url TEXT NULL,
            button_label VARCHAR(80) NULL,
            button_url TEXT NULL,
            coupon_code VARCHAR(64) NULL,
            request_id INTEGER NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_messages_request_id
            ON discord_coupon_messages (request_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_outbound_queue (
            id SERIAL PRIMARY KEY,
            guild_id VARCHAR(25) NOT NULL,
            channel_id VARCHAR(25) NOT NULL,
            payload JSONB NOT NULL,
            coupon_message_id INTEGER NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_outbound_queue_status
            ON discord_outbound_queue (status)
    `);
}

// Bit MANAGE_GUILD = 0x20 (32)
const MANAGE_GUILD_BIT = 0x20n;
function hasManageGuild(permissionsString) {
    try {
        const perms = BigInt(permissionsString || "0");
        return (perms & MANAGE_GUILD_BIT) === MANAGE_GUILD_BIT;
    } catch {
        return false;
    }
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

// GET /api/discord/panel/guilds — guilds do user que tem MANAGE_GUILD E onde o bot está
router.get("/guilds", verifyToken, async (req, res) => {
    try {
        const accessToken = await getUserAccessToken(req.user.ReferenciaID);
        if (!accessToken) return res.status(400).json({ error: "Discord não ligado", code: "NOT_LINKED" });

        let userGuilds;
        try {
            userGuilds = await discordFetchUserGuilds(accessToken);
        } catch (err) {
            console.error("[DISCORD-PANEL] /guilds Discord API erro:", err.message);
            return res.status(401).json({ error: "Token Discord expirado, reconecta a conta", code: "DISCORD_TOKEN_EXPIRED" });
        }

        const [botRows] = await pool.query(
            `SELECT guild_id, guild_name, guild_icon FROM corporation_discord_guilds WHERE removed_at IS NULL`
        );
        const botGuildIds = new Set(botRows.map(r => r.guild_id));

        const manageable = userGuilds
            .filter(g => hasManageGuild(g.permissions))
            .map(g => ({
                id: g.id,
                name: g.name,
                icon: g.icon,
                icon_url: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
                bot_present: botGuildIds.has(g.id),
                owner: g.owner,
            }));

        manageable.sort((a, b) => {
            if (a.bot_present !== b.bot_present) return a.bot_present ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        res.json({ guilds: manageable });
    } catch (err) {
        console.error("[DISCORD-PANEL] /guilds erro:", err);
        res.status(500).json({ error: "Falha ao listar servidores" });
    }
});

// GET /api/discord/panel/guilds/:guildId/channels — canais de texto onde o bot pode escrever
router.get("/guilds/:guildId/channels", verifyToken, async (req, res) => {
    const { guildId } = req.params;
    if (!/^\d{15,25}$/.test(guildId)) return res.status(400).json({ error: "guildId inválido" });

    try {
        const [botRows] = await pool.query(
            `SELECT 1 FROM corporation_discord_guilds WHERE guild_id = ? AND removed_at IS NULL LIMIT 1`,
            [guildId]
        );
        if (!botRows || botRows.length === 0) {
            return res.status(404).json({ error: "Bot não está neste servidor", code: "BOT_NOT_IN_GUILD" });
        }

        const accessToken = await getUserAccessToken(req.user.ReferenciaID);
        if (!accessToken) return res.status(400).json({ error: "Discord não ligado", code: "NOT_LINKED" });
        const userGuilds = await discordFetchUserGuilds(accessToken);
        const userGuild = userGuilds.find(g => g.id === guildId);
        if (!userGuild || !hasManageGuild(userGuild.permissions)) {
            return res.status(403).json({ error: "Sem permissão MANAGE_GUILD neste servidor" });
        }

        const channels = await discordBotFetchChannels(guildId);
        const textChannels = channels
            .filter(c => c.type === 0 || c.type === 5) // 0=text, 5=announcement
            .map(c => ({ id: c.id, name: c.name, type: c.type, position: c.position, parent_id: c.parent_id }))
            .sort((a, b) => a.position - b.position);

        res.json({ channels: textChannels });
    } catch (err) {
        console.error("[DISCORD-PANEL] /channels erro:", err);
        res.status(500).json({ error: "Falha ao listar canais" });
    }
});

function sanitizeCouponPayload(body) {
    const errors = [];
    const out = {
        guild_id: String(body.guild_id || "").trim(),
        channel_id: String(body.channel_id || "").trim(),
        title: body.title ? String(body.title).slice(0, 256) : null,
        description: body.description ? String(body.description).slice(0, 4000) : null,
        color: typeof body.color === "number" ? body.color : null,
        image_url: body.image_url ? String(body.image_url).slice(0, 2000) : null,
        button_label: body.button_label ? String(body.button_label).slice(0, 80) : null,
        button_url: body.button_url ? String(body.button_url).slice(0, 2000) : null,
        coupon_code: body.coupon_code ? String(body.coupon_code).slice(0, 64) : null,
    };
    if (!/^\d{15,25}$/.test(out.guild_id)) errors.push("guild_id inválido");
    if (!/^\d{15,25}$/.test(out.channel_id)) errors.push("channel_id inválido");
    if (!out.title && !out.description) errors.push("É preciso pelo menos title ou description");
    if (out.image_url && !/^https?:\/\//i.test(out.image_url)) errors.push("image_url deve começar com http(s)://");
    if (out.button_url && !/^https?:\/\//i.test(out.button_url)) errors.push("button_url deve começar com http(s)://");
    if ((out.button_label && !out.button_url) || (out.button_url && !out.button_label)) errors.push("Botão precisa de label E url");
    return { payload: out, errors };
}

async function userHasManageGuild(referenciaId, guildId) {
    const accessToken = await getUserAccessToken(referenciaId);
    if (!accessToken) return { ok: false, code: "NOT_LINKED" };
    let userGuilds;
    try {
        userGuilds = await discordFetchUserGuilds(accessToken);
    } catch {
        return { ok: false, code: "DISCORD_TOKEN_EXPIRED" };
    }
    const g = userGuilds.find(x => x.id === guildId);
    if (!g || !hasManageGuild(g.permissions)) return { ok: false, code: "NO_PERMISSION" };
    return { ok: true };
}

// POST /api/discord/panel/send — envio direto (apenas corp, perfilId=3)
router.post("/send", verifyToken, async (req, res) => {
    await ensureDiscordCouponTables();
    const perfilId = await getRequestPerfilId(req);
    if (perfilId !== 3) {
        return res.status(403).json({ error: "Apenas utilizadores corporativos podem enviar diretamente. Use /request." });
    }
    const { payload, errors } = sanitizeCouponPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });

    try {
        const [botRows] = await pool.query(
            `SELECT 1 FROM corporation_discord_guilds WHERE guild_id = ? AND removed_at IS NULL LIMIT 1`,
            [payload.guild_id]
        );
        if (!botRows || botRows.length === 0) return res.status(404).json({ error: "Bot não está neste servidor" });

        const perm = await userHasManageGuild(req.user.ReferenciaID, payload.guild_id);
        if (!perm.ok) return res.status(403).json({ error: "Sem permissão MANAGE_GUILD", code: perm.code });

        const [msgIns] = await pool.query(
            `INSERT INTO discord_coupon_messages
                (sent_by_referenciaid, guild_id, channel_id, title, description, color, image_url, button_label, button_url, coupon_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [req.user.ReferenciaID, payload.guild_id, payload.channel_id, payload.title, payload.description, payload.color, payload.image_url, payload.button_label, payload.button_url, payload.coupon_code]
        );
        const messageRowId = msgIns[0].id;

        await pool.query(
            `INSERT INTO discord_outbound_queue (guild_id, channel_id, payload, coupon_message_id)
             VALUES (?, ?, ?::jsonb, ?)`,
            [payload.guild_id, payload.channel_id, JSON.stringify(payload), messageRowId]
        );

        res.json({ ok: true, queued: true, message_row_id: messageRowId });
    } catch (err) {
        console.error("[DISCORD-PANEL] /send erro:", err);
        res.status(500).json({ error: "Falha ao enfileirar envio" });
    }
});

// POST /api/discord/panel/request — suporte cria solicitação
router.post("/request", verifyToken, async (req, res) => {
    await ensureDiscordCouponTables();
    const { payload, errors } = sanitizeCouponPayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join("; ") });
    try {
        const [ins] = await pool.query(
            `INSERT INTO discord_coupon_requests
                (requested_by_referenciaid, target_guild_id, target_channel_id, title, description, color, image_url, button_label, button_url, coupon_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [req.user.ReferenciaID, payload.guild_id, payload.channel_id, payload.title, payload.description, payload.color, payload.image_url, payload.button_label, payload.button_url, payload.coupon_code]
        );
        res.json({ ok: true, request_id: ins[0].id });
    } catch (err) {
        console.error("[DISCORD-PANEL] /request erro:", err);
        res.status(500).json({ error: "Falha ao criar solicitação" });
    }
});

// GET /api/discord/panel/requests — corp vê todas pendentes; suporte vê as suas
router.get("/requests", verifyToken, async (req, res) => {
    await ensureDiscordCouponTables();
    const isCorp = (await getRequestPerfilId(req)) === 3;
    try {
        let rows;
        if (isCorp) {
            const status = req.query.status || 'pending';
            [rows] = await pool.query(
                `SELECT r.id, r.requested_by_referenciaid, r.target_guild_id, r.target_channel_id,
                        r.title, r.description, r.color, r.image_url, r.button_label, r.button_url, r.coupon_code,
                        r.status, r.review_note, r.created_at, r.reviewed_at,
                        u.nome AS requester_name, u.email AS requester_email
                   FROM discord_coupon_requests r
                   LEFT JOIN utilizadores u ON u.referenciaid = r.requested_by_referenciaid
                  WHERE r.status = ?
                  ORDER BY r.created_at DESC LIMIT 100`,
                [status]
            );
        } else {
            [rows] = await pool.query(
                `SELECT id, target_guild_id, target_channel_id, title, description, color, image_url,
                        button_label, button_url, coupon_code, status, review_note, created_at, reviewed_at
                   FROM discord_coupon_requests
                  WHERE requested_by_referenciaid = ?
                  ORDER BY created_at DESC LIMIT 100`,
                [req.user.ReferenciaID]
            );
        }
        res.json({ requests: rows || [] });
    } catch (err) {
        console.error("[DISCORD-PANEL] /requests erro:", err);
        res.status(500).json({ error: "Falha ao listar solicitações" });
    }
});

// POST /api/discord/panel/requests/:id/approve — corp aprova → enfileira envio
router.post("/requests/:id/approve", verifyToken, async (req, res) => {
    await ensureDiscordCouponTables();
    const perfilId = await getRequestPerfilId(req);
    if (perfilId !== 3) {
        return res.status(403).json({ error: "Apenas corp pode aprovar" });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "id inválido" });
    try {
        const [reqRows] = await pool.query(
            `SELECT * FROM discord_coupon_requests WHERE id = ? AND status = 'pending' LIMIT 1`,
            [id]
        );
        if (!reqRows || reqRows.length === 0) return res.status(404).json({ error: "Solicitação não encontrada ou já revista" });
        const r = reqRows[0];

        const [botRows] = await pool.query(
            `SELECT 1 FROM corporation_discord_guilds WHERE guild_id = ? AND removed_at IS NULL LIMIT 1`,
            [r.target_guild_id]
        );
        if (!botRows || botRows.length === 0) return res.status(400).json({ error: "Bot não está mais no servidor alvo" });

        const payload = {
            guild_id: r.target_guild_id, channel_id: r.target_channel_id,
            title: r.title, description: r.description, color: r.color,
            image_url: r.image_url, button_label: r.button_label, button_url: r.button_url,
            coupon_code: r.coupon_code,
        };

        const [msgIns] = await pool.query(
            `INSERT INTO discord_coupon_messages
                (sent_by_referenciaid, guild_id, channel_id, title, description, color, image_url, button_label, button_url, coupon_code, request_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [req.user.ReferenciaID, r.target_guild_id, r.target_channel_id, r.title, r.description, r.color, r.image_url, r.button_label, r.button_url, r.coupon_code, id]
        );

        await pool.query(
            `INSERT INTO discord_outbound_queue (guild_id, channel_id, payload, coupon_message_id) VALUES (?, ?, ?::jsonb, ?)`,
            [r.target_guild_id, r.target_channel_id, JSON.stringify(payload), msgIns[0].id]
        );

        await pool.query(
            `UPDATE discord_coupon_requests SET status = 'approved', reviewed_by_referenciaid = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ? WHERE id = ?`,
            [req.user.ReferenciaID, req.body.note || null, id]
        );

        res.json({ ok: true, message_row_id: msgIns[0].id });
    } catch (err) {
        console.error("[DISCORD-PANEL] /approve erro:", err);
        res.status(500).json({ error: "Falha ao aprovar" });
    }
});

// POST /api/discord/panel/requests/:id/reject
router.post("/requests/:id/reject", verifyToken, async (req, res) => {
    await ensureDiscordCouponTables();
    const perfilId = await getRequestPerfilId(req);
    if (perfilId !== 3) {
        return res.status(403).json({ error: "Apenas corp pode rejeitar" });
    }
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "id inválido" });
    try {
        const [upd] = await pool.query(
            `UPDATE discord_coupon_requests SET status = 'rejected', reviewed_by_referenciaid = ?, reviewed_at = CURRENT_TIMESTAMP, review_note = ? WHERE id = ? AND status = 'pending'`,
            [req.user.ReferenciaID, req.body.note || null, id]
        );
        const affected = upd.affectedRows !== undefined ? upd.affectedRows : (upd.rowCount || 0);
        if (!affected) return res.status(404).json({ error: "Solicitação não encontrada ou já revista" });
        res.json({ ok: true });
    } catch (err) {
        console.error("[DISCORD-PANEL] /reject erro:", err);
        res.status(500).json({ error: "Falha ao rejeitar" });
    }
});

export default router;
