import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env"), quiet: true });

const res = await fetch("https://discord.com/api/v10/oauth2/applications/@me", {
    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
});
const app = await res.json();
console.log("Discord app id:", app.id);
console.log("Expected APPLICATION_ID:", process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID);
console.log("PUBLIC_KEY length:", (process.env.PUBLIC_KEY || "").trim().length);
console.log("Match:", String(app.id) === String(process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID));
