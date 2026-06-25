/**
 * Regista metadata de Linked Roles na aplicação Discord.
 * Executar uma vez após configurar DISCORD_BOT_TOKEN e APPLICATION_ID no .env
 *
 *   node scripts/setup-discord-linked-roles.js
 */
import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { LINKED_ROLE_METADATA_DEFINITIONS } from "../backend/services/discordLinkedRoles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env"), quiet: true });

const applicationId = process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
const baseUrl = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || "https://promoping.pt").replace(/\/$/, "");

if (!applicationId || !botToken) {
    console.error("Defina APPLICATION_ID (ou DISCORD_CLIENT_ID) e DISCORD_BOT_TOKEN no .env");
    process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${applicationId}/role-connections/metadata`;

const res = await fetch(url, {
    method: "PUT",
    headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
    },
    body: JSON.stringify(LINKED_ROLE_METADATA_DEFINITIONS),
});

const text = await res.text();
if (!res.ok) {
    console.error("Falha ao registar metadata:", res.status, text);
    process.exit(1);
}

console.log("Linked Roles metadata registada com sucesso.");
console.log("");
console.log("URLs para o Discord Developer Portal:");
console.log("  Interactions Endpoint URL:     (deixar VAZIO — os slash commands usam o bot via Gateway)");
console.log(`  Linked Roles Verification URL: ${baseUrl}/verify-user`);
console.log(`  Terms of Service URL:          ${baseUrl}/docs/terms-of-service`);
console.log(`  Privacy Policy URL:            ${baseUrl}/docs/privacy-policy`);
