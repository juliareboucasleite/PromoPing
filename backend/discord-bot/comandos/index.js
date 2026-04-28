const fs = require("fs");
const path = require("path");

const comandos = new Map();
const skippedDirs = new Set(["Giveaways", "Music", "profile", "verify"]);

function listCommandFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name === "index.js" || entry.name.startsWith("_")) {
            continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (skippedDirs.has(entry.name)) {
                continue;
            }
            files.push(...listCommandFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(fullPath);
        }
    }

    return files;
}

function looksLikeSimpleCommand(filePath) {
    try {
        const source = fs.readFileSync(filePath, "utf8");
        return source.includes("module.exports = {");
    } catch {
        return false;
    }
}

try {
    const commandFiles = listCommandFiles(__dirname).filter(looksLikeSimpleCommand);

    for (const filePath of commandFiles) {
        try {
            const comando = require(filePath);
            if (!comando?.name || typeof comando.execute !== "function") {
                continue;
            }

            const commandName = String(comando.name).trim().toLowerCase();
            if (!commandName || comandos.has(commandName)) {
                continue;
            }

            comandos.set(commandName, comando);

            if (Array.isArray(comando.aliases)) {
                for (const alias of comando.aliases) {
                    const aliasName = String(alias || "").trim().toLowerCase();
                    if (!aliasName || comandos.has(aliasName)) {
                        continue;
                    }
                    comandos.set(aliasName, comando);
                }
            }
        } catch (error) {
            console.error(`[DISCORD] Erro ao carregar comando ${path.relative(__dirname, filePath)}:`, error.message);
        }
    }
} catch (error) {
    console.error("[DISCORD] Erro ao carregar comandos:", error.message);
}

module.exports = comandos;
