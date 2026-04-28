const fs = require("fs");
const path = require("path");

const comandos = new Map();

function listCommandFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const directories = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
        .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".js") && entry.name !== "index.js" && !entry.name.startsWith("_"))
        .sort((a, b) => a.name.localeCompare(b.name));

    const commandFiles = [];

    for (const entry of directories) {
        commandFiles.push(...listCommandFiles(path.join(dir, entry.name)));
    }

    for (const entry of files) {
        commandFiles.push(path.join(dir, entry.name));
    }

    return commandFiles;
}

function looksLikeSimpleCommand(filePath) {
    try {
        const source = fs.readFileSync(filePath, "utf8");
        return source.includes("module.exports = {");
    } catch {
        return false;
    }
}

function deriveCategory(filePath, commandName, explicitCategory) {
    const normalizedExplicit = String(explicitCategory || "").trim();
    if (normalizedExplicit) {
        return normalizedExplicit;
    }

    const relativeDir = path.relative(__dirname, path.dirname(filePath));
    if (relativeDir && relativeDir !== ".") {
        return relativeDir.split(path.sep)[0];
    }

    return "Geral";
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

            comando.category = deriveCategory(filePath, commandName, comando.category);
            comando.filePath = path.relative(__dirname, filePath);
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
