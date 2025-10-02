import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPresence() {
  console.log("🧪 Testando configuração do Discord Rich Presence...\n");
  if (!fs.existsSync("presence.js")) {
    console.log("❌ Arquivo presence.js não encontrado!");
    process.exit(1);
  }

  const configPath = path.join(__dirname, "discord-config.js");
  if (!fs.existsSync(configPath)) {
    console.log("⚠️  Arquivo discord-config.js não encontrado!");
    console.log("📝 Copie discord-config.example.js para discord-config.js");
    console.log("📝 Configure seu Client ID do Discord");
    process.exit(1);
  }

  try {
    const configUrl = `file://${configPath.replace(/\\/g, '/')}`;
    const configModule = await import(configUrl);
    const config = configModule.default || configModule;
    
    if (!config.clientId || config.clientId === "SEU_CLIENT_ID_AQUI") {
      console.log("❌ Client ID não configurado!");
      console.log("📝 Edite discord-config.js e configure seu Client ID");
      process.exit(1);
    }
    
    console.log("✅ Configuração encontrada!");
    console.log(`🎮 Client ID: ${config.clientId}`);
    
    if (config.settings) {
      console.log("⚙️  Configurações personalizadas:");
      if (config.settings.texts) {
        console.log(`   📝 Details: ${config.settings.texts.details}`);
        console.log(`   📝 State: ${config.settings.texts.state}`);
      }
      if (config.settings.urls) {
        console.log(`   🔗 Site: ${config.settings.urls.site}`);
        console.log(`   🔗 GitHub: ${config.settings.urls.github}`);
      }
    }
    
    console.log("\n✅ Configuração válida! Rich Presence deve funcionar.");
    console.log("🚀 Execute 'npm start' para iniciar com Rich Presence!");
    
  } catch (error) {
    console.log("❌ Erro ao carregar configuração:", error.message);
    process.exit(1);
  }
}

testPresence();
