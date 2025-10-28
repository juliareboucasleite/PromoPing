// scripts/release.js
// Sistema de automação de versionamento e publicação do PromoPing
// Agora com detecção automática de pré-lançamento (beta, rc, dev)

import fs from "fs";
import { execSync } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const versionArg = process.argv[2];
if (!versionArg) {
  console.error("\nUso correto: npm run release v2.4.0 ou v2.4.0-beta.1\n");
  process.exit(1);
}

// Verifica formato da versão
if (!/^v\d+\.\d+\.\d+(-[\w.\-]+)?$/.test(versionArg)) {
  console.error("\nFormato inválido. Use: v2.4.0, v2.4.0-beta, v2.4.0-rc.1, etc.\n");
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
packageJson.version = versionArg.replace(/^v/, "");
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
console.log("package.json atualizado.\n");

// 2. Atualizar CHANGELOG.md automaticamente
const changelogPath = "CHANGELOG.md";
if (!fs.existsSync(changelogPath)) {
  fs.writeFileSync(changelogPath, "# Changelog — PromoPing\n\n");
}

let changelog = fs.readFileSync(changelogPath, "utf-8");
const currentDate = new Date().toISOString().split("T")[0];
if (!changelog.includes(`## ${versionArg}`)) {
  console.log("Nova versão não encontrada no CHANGELOG.md. Adicionando cabeçalho...\n");
  const newEntry = `## ${versionArg} (${currentDate})\n- Notas ainda não adicionadas.\n\n` + changelog;
  fs.writeFileSync(changelogPath, newEntry);
}

// 3. Commit se necessário
execSync("git add -A", { stdio: "inherit" });
try {
  execSync(`git diff --cached --quiet || git commit -m "chore(release): update to ${versionArg}"`, { stdio: "inherit", shell: true });
  console.log("Commit criado.\n");
} catch {
  console.log("Nenhuma alteração a commitar.\n");
}

// 4. Remover tag existente
try {
  execSync(`git tag -d ${versionArg}`, { stdio: "ignore" });
  execSync(`git push origin :refs/tags/${versionArg}`, { stdio: "ignore" });
  console.log(`Tag antiga ${versionArg} removida.\n`);
} catch {}

// 5. Criar e enviar tag
execSync(`git tag -a ${versionArg} -m "Release ${versionArg}"`, { stdio: "inherit" });
execSync(`git push origin main --tags`, { stdio: "inherit" });
console.log(`Tag ${versionArg} criada e enviada.\n`);

// 6. Extrair notas do CHANGELOG.md
changelog = fs.readFileSync(changelogPath, "utf-8");
const regex = new RegExp(`## ${versionArg}[\\s\\S]*?(?=\\n## |$)`, "m");
const match = changelog.match(regex);
const releaseNotes = match ? match[0].replace(`## ${versionArg}`, "").trim() : "Sem notas disponíveis.";

// 7. Detectar se é pré-lançamento
const isPreRelease = /-(beta|rc|alpha|dev)/i.test(versionArg);
console.log(isPreRelease ? "Publicando como pré-lançamento (pré-release)..." : "Publicando como release final...");

// 8. Determinar repositório GitHub
const repoUrl = execSync("git config --get remote.origin.url").toString().trim();
const repoMatch = repoUrl.match(/github\.com[:/](.+\/.+?)(?:\.git)?$/);
if (!repoMatch) {
  console.error("Não foi possível determinar o repositório GitHub.");
  process.exit(1);
}
const repo = repoMatch[1];

// 9. Criar release via API
const response = await fetch(`https://api.github.com/repos/${repo}/releases`, {
  method: "POST",
  headers: {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "PromoPing-Release-Script"
  },
  body: JSON.stringify({
    tag_name: versionArg,
    name: versionArg,
    body: releaseNotes,
    draft: false,
    prerelease: isPreRelease
  })
});

if (response.ok) {
  console.log(` Release ${versionArg} publicada com sucesso no GitHub.\n`);
} else {
  const error = await response.text();
  console.error("Erro ao criar release:");
  console.error(error);
  process.exit(1);
}

console.log("Processo de release concluído.\n");
