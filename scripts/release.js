// scripts/release.js
// Script de automação de versão e publicação de release no GitHub
// Desenvolvido para o projeto PromoPing

import fs from "fs";
import { execSync } from "child_process";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const versionArg = process.argv[2];
if (!versionArg) {
  console.error("\nUso correto: npm run release v2.2.0-planeada\n");
  process.exit(1);
}

// Verifica se a versão está no formato correto
if (!/^v\d+\.\d+\.\d+(-[\w-]+)?$/.test(versionArg)) {
  console.error("\nFormato inválido. Use por exemplo: v2.2.0-planeada ou v2.1.3-hotfix-login\n");
  process.exit(1);
}

// Verifica se o token GitHub existe
const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error("\nErro: variável GITHUB_TOKEN não encontrada no .env\n");
  process.exit(1);
}

console.log(`\nIniciando processo de release para ${versionArg}...\n`);

// 1. Atualizar versão no package.json
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
packageJson.version = versionArg.replace(/^v/, ""); // remove o "v" do início
fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 2));
console.log("package.json atualizado.\n");

// 2. Criar commit apenas se houver alterações
execSync("git add -A", { stdio: "inherit" });

try {
  execSync(`git diff --cached --quiet || git commit -m "chore(release): update to ${versionArg}"`, { stdio: "inherit", shell: true });
  console.log("Commit criado com sucesso.\n");
} catch {
  console.log("Nenhuma alteração a commitar. Continuando...\n");
}

// 3. Criar tag e enviar
try {
  execSync(`git tag -a ${versionArg} -m "Release ${versionArg}"`, { stdio: "inherit" });
  execSync(`git push origin main --tags`, { stdio: "inherit" });
  console.log(`Tag ${versionArg} criada e enviada.\n`);
} catch (error) {
  console.error("Erro ao criar/enviar tag:", error.message);
  process.exit(1);
}

// 4. Extrair notas da versão do CHANGELOG.md
const changelog = fs.readFileSync("CHANGELOG.md", "utf-8");
const regex = new RegExp(`## ${versionArg}[\\s\\S]*?(?=\\n## |$)`, "m");
const match = changelog.match(regex);
const releaseNotes = match ? match[0].replace(`## ${versionArg}`, "").trim() : "Sem notas disponíveis.";
console.log("Notas da release extraídas do CHANGELOG.md\n");

// 5. Criar release via API do GitHub
const repoUrl = execSync("git config --get remote.origin.url").toString().trim();
const repoMatch = repoUrl.match(/github\.com[:/](.+\/.+?)(?:\.git)?$/);
if (!repoMatch) {
  console.error("Não foi possível determinar o repositório GitHub a partir do remote origin.");
  process.exit(1);
}
const repo = repoMatch[1];

console.log(`Publicando release no repositório: ${repo}\n`);

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
    console.log(`Release ${versionArg} criada com sucesso no GitHub.\n`);
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
