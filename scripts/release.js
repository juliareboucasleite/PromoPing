// scripts/release.js
// Sistema automático de versionamento e publicação do PromoPing
// Inclui criação automática de cabeçalho no CHANGELOG.md e remoção de tags duplicadas

import fs from "fs";
import { execSync } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const versionArg = process.argv[2];
if (!versionArg) {
  console.error("\nUso correto: npm run release v2.3.0-update\n");
  process.exit(1);
}

// 1. Validar formato de versão
if (!/^v\d+\.\d+\.\d+(-[\w-]+)?$/.test(versionArg)) {
  console.error("\nFormato inválido. Use por exemplo: v2.3.0-update ou v2.1.3-hotfix-login\n");
  process.exit(1);
}

// 2. Verificar token GitHub
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("\nErro: variável GITHUB_TOKEN não encontrada no .env\n");
  process.exit(1);
}

console.log(`\nIniciando processo de release para ${versionArg}...\n`);

// 3. Atualizar versão no package.json
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
packageJson.version = versionArg.replace(/^v/, "");
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
console.log("package.json atualizado.\n");

// 4. Atualizar CHANGELOG.md automaticamente
const changelogPath = "CHANGELOG.md";
if (!fs.existsSync(changelogPath)) {
  console.log("Arquivo CHANGELOG.md não encontrado. Criando novo...");
  fs.writeFileSync(changelogPath, "# Changelog — PromoPing\n\n");
}

let changelog = fs.readFileSync(changelogPath, "utf-8");
const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

if (!changelog.includes(`## ${versionArg}`)) {
  console.log("Nova versão não encontrada no CHANGELOG.md. Adicionando cabeçalho automaticamente...\n");
  const newEntry = `## ${versionArg} (${currentDate})\n- Notas ainda não adicionadas.\n\n` + changelog;
  fs.writeFileSync(changelogPath, newEntry);
} else {
  console.log("Versão já existe no CHANGELOG.md.\n");
}

// 5. Commit apenas se houver alterações
execSync("git add -A", { stdio: "inherit" });
try {
  execSync(`git diff --cached --quiet || git commit -m "chore(release): update to ${versionArg}"`, { stdio: "inherit", shell: true });
  console.log("Commit criado com sucesso.\n");
} catch {
  console.log("Nenhuma alteração a commitar. Continuando...\n");
}

// 6. Remover tag existente (local e remota)
try {
  console.log(`Verificando se a tag ${versionArg} já existe...\n`);
  execSync(`git tag -d ${versionArg}`, { stdio: "inherit" });
  execSync(`git push origin :refs/tags/${versionArg}`, { stdio: "inherit" });
  console.log(`Tag antiga ${versionArg} removida com sucesso.\n`);
} catch {
  console.log("Nenhuma tag anterior encontrada.\n");
}

// 7. Criar e enviar nova tag
try {
  execSync(`git tag -a ${versionArg} -m "Release ${versionArg}"`, { stdio: "inherit" });
  execSync(`git push origin main --tags`, { stdio: "inherit" });
  console.log(`Tag ${versionArg} criada e enviada com sucesso.\n`);
} catch (error) {
  console.error("Erro ao criar/enviar tag:", error.message);
  process.exit(1);
}

// 8. Extrair notas da versão do CHANGELOG.md
changelog = fs.readFileSync(changelogPath, "utf-8");
const regex = new RegExp(`## ${versionArg}[\\s\\S]*?(?=\\n## |$)`, "m");
const match = changelog.match(regex);
const releaseNotes = match ? match[0].replace(`## ${versionArg}`, "").trim() : "Sem notas disponíveis.";
console.log("Notas da release extraídas do CHANGELOG.md.\n");

// 9. Determinar o repositório GitHub
const repoUrl = execSync("git config --get remote.origin.url").toString().trim();
const repoMatch = repoUrl.match(/github\.com[:/](.+\/.+?)(?:\.git)?$/);
if (!repoMatch) {
  console.error("Não foi possível determinar o repositório GitHub a partir do remote origin.");
  process.exit(1);
}
const repo = repoMatch[1];
console.log(`Publicando release no repositório: ${repo}\n`);

// 10. Criar release via API GitHub
try {
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
      prerelease: versionArg.includes("beta") || versionArg.includes("rc")
    })
  });

  if (response.ok) {
    console.log(`Release ${versionArg} publicada com sucesso no GitHub.\n`);
  } else {
    const error = await response.text();
    console.error("Erro ao criar release no GitHub:");
    console.error(error);
    process.exit(1);
  }
} catch (error) {
  console.error("Falha ao conectar à API GitHub:", error.message);
  process.exit(1);
}

console.log("Processo de release concluído com sucesso.\n");
