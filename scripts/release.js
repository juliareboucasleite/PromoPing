// scripts/release.js
// Sistema de automação de versionamento e publicação do PromoPing
// Agora com detecção automática de pré-lançamento (beta, rc, dev)

import fs from "fs";
import { execSync } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Sanitiza e valida a versão para prevenir command injection
 * @param {string} version - Versão a ser validada
 * @returns {string} Versão sanitizada
 * @throws {Error} Se a versão for inválida
 */
function sanitizeVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error('Versão é obrigatória');
  }
  
  // Remove caracteres perigosos
  const sanitized = version.trim().replace(/[;&|`$(){}[\]<>'"\\]/g, '');
  
  // Valida formato: v1.2.3 ou v1.2.3-beta.1
  if (!/^v\d+\.\d+\.\d+(-[\w.\-]+)?$/.test(sanitized)) {
    throw new Error('Formato inválido. Use: v2.4.0, v2.4.0-beta, v2.4.0-rc.1, etc.');
  }
  
  return sanitized;
}

/**
 * Valida URL do GitHub para prevenir SSRF
 * @param {string} url - URL a ser validada
 * @returns {boolean} True se a URL é segura
 */
function isValidGitHubUrl(url) {
  try {
    const parsed = new URL(url);
    // Permitir apenas HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Permitir apenas api.github.com
    if (parsed.hostname !== 'api.github.com') {
      return false;
    }
    // Bloquear IPs privados e localhost
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const versionArg = process.argv[2];
if (!versionArg) {
  console.error("\nUso correto: npm run release v2.4.0 ou v2.4.0-beta.1\n");
  process.exit(1);
}

// Sanitizar e validar versão
let safeVersion;
try {
  safeVersion = sanitizeVersion(versionArg);
} catch (error) {
  console.error(`\n${error.message}\n`);
  process.exit(1);
}

// Verifica token GitHub
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("\nErro: variável GITHUB_TOKEN não encontrada no .env\n");
  process.exit(1);
}

console.log(`\n Iniciando processo de release para ${versionArg}...\n`);

// 1. Atualizar versão no package.json
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
packageJson.version = safeVersion.replace(/^v/, "");
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
console.log("package.json atualizado.\n");

// 2. Atualizar CHANGELOG.md automaticamente
const changelogPath = "CHANGELOG.md";
if (!fs.existsSync(changelogPath)) {
  fs.writeFileSync(changelogPath, "# Changelog — PromoPing\n\n");
}

let changelog = fs.readFileSync(changelogPath, "utf-8");
const currentDate = new Date().toISOString().split("T")[0];
if (!changelog.includes(`## ${safeVersion}`)) {
  console.log("Nova versão não encontrada no CHANGELOG.md. Adicionando cabeçalho...\n");
  const newEntry = `## ${safeVersion} (${currentDate})\n- Notas ainda não adicionadas.\n\n` + changelog;
  fs.writeFileSync(changelogPath, newEntry);
}

// 3. Commit se necessário
execSync("git add -A", { stdio: "inherit", shell: false });
try {
  // Usar array de argumentos ao invés de string para prevenir injection
  execSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
  // Se chegou aqui, há alterações - fazer commit
  const commitMessage = `chore(release): update to ${safeVersion}`;
  execSync("git", ["commit", "-m", commitMessage], { stdio: "inherit" });
  console.log("Commit criado.\n");
} catch {
  console.log("Nenhuma alteração a commitar.\n");
}

// 4. Remover tag existente
try {
  execSync("git", ["tag", "-d", safeVersion], { stdio: "ignore" });
  execSync("git", ["push", "origin", `:refs/tags/${safeVersion}`], { stdio: "ignore" });
  console.log(`Tag antiga ${safeVersion} removida.\n`);
} catch {}

// 5. Criar e enviar tag
const tagMessage = `Release ${safeVersion}`;
execSync("git", ["tag", "-a", safeVersion, "-m", tagMessage], { stdio: "inherit" });
execSync("git", ["push", "origin", "main", "--tags"], { stdio: "inherit" });
console.log(`Tag ${safeVersion} criada e enviada.\n`);

// 6. Extrair notas do CHANGELOG.md
changelog = fs.readFileSync(changelogPath, "utf-8");
// Escapar caracteres especiais na versão para uso em regex
const escapedVersion = safeVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(`## ${escapedVersion}[\\s\\S]*?(?=\\n## |$)`, "m");
const match = changelog.match(regex);
const releaseNotes = match ? match[0].replace(`## ${safeVersion}`, "").trim() : "Sem notas disponíveis.";

// 7. Detectar se é pré-lançamento
const isPreRelease = /-(beta|rc|alpha|dev)/i.test(safeVersion);
console.log(isPreRelease ? "Publicando como pré-lançamento (pré-release)..." : "Publicando como release final...");

// 8. Determinar repositório GitHub
const repoUrl = execSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf-8" }).trim();
const repoMatch = repoUrl.match(/github\.com[:/]([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+?)(?:\.git)?$/);
if (!repoMatch) {
  console.error("Não foi possível determinar o repositório GitHub.");
  process.exit(1);
}
const repo = repoMatch[1];

// Validar formato do repositório (apenas alfanuméricos, pontos, hífens e underscores)
if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
  console.error("Formato de repositório inválido.");
  process.exit(1);
}

// Criar release via API - Validar URL antes de fazer fetch
const apiUrl = `https://api.github.com/repos/${repo}/releases`;
if (!isValidGitHubUrl(apiUrl)) {
  console.error("URL da API GitHub inválida ou insegura.");
  process.exit(1);
}

const response = await fetch(apiUrl, {
  method: "POST",
  headers: {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "PromoPing-Release-Script"
  },
  body: JSON.stringify({
    tag_name: safeVersion,
    name: safeVersion,
    body: releaseNotes,
    draft: false,
    prerelease: isPreRelease
  })
});

if (response.ok) {
  console.log(` Release ${safeVersion} publicada com sucesso no GitHub.\n`);
} else {
  const error = await response.text();
  console.error("Erro ao criar release:");
  console.error(error);
  process.exit(1);
}

console.log("Processo de release concluído.\n");
