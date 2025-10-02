import RPC from "discord-rpc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initPresence() {
  let config = null;
  const configPath = "./discord-config.js";

  if (fs.existsSync(configPath)) {
    try {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    } catch (error) {
      console.log("⚠️  Erro ao carregar discord-config.js:", error.message);
      console.log("⚠️  Usando configuração padrão");
    }
  }

  const clientId = config?.clientId || "SEU_CLIENT_ID_DISCORD";
  const settings = config?.settings || {};
  if (clientId === "SEU_CLIENT_ID_DISCORD" || clientId === "SEU_CLIENT_ID_AQUI") {
    console.log("⚠️  Configure seu Client ID do Discord:");
    console.log("📝 1. Copie discord-config.example.js para discord-config.js");
    console.log("📝 2. Configure seu Client ID em discord-config.js");
    console.log("📝 3. Acesse: https://discord.com/developers/applications");
    process.exit(1);
  }

  const rpc = new RPC.Client({ transport: "ipc" });
  RPC.register(clientId);
  let isConnected = false;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = settings.maxReconnectAttempts || 5;
  const reconnectDelay = settings.reconnectDelay || 5000;
  const updateInterval = settings.updateInterval || 30000;

function connectToDiscord() {
  rpc.login({ clientId })
    .then(() => {
      console.log("✅ Conectado ao Discord Rich Presence!");
      isConnected = true;
      reconnectAttempts = 0;
    })
    .catch((error) => {
      console.error("❌ Erro ao conectar ao Discord:", error.message);
      isConnected = false;
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        console.log(`🔄 Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts} em ${reconnectDelay/1000} segundos...`);
        setTimeout(connectToDiscord, reconnectDelay);
      } else {
        console.log("❌ Máximo de tentativas de reconexão atingido. Rich Presence desabilitado.");
      }
    });
}


rpc.on("ready", () => {
  console.log("🎮 Rich Presence ativo no Discord!");
  updateActivity();
  setInterval(updateActivity, updateInterval);
});

function updateActivity() {
  if (!isConnected) return;
  
  const startTime = Date.now();
  
  const texts = settings.texts || {};
  const urls = settings.urls || {};
  const images = settings.images || {};
  
  rpc.setActivity({
    details: texts.details || "PromoPing - Monitor de Preços",
    state: texts.state || "Servidor rodando localmente",
    largeImageKey: images.largeImageKey || "promoping-logo",
    largeImageText: texts.largeImageText || "PromoPing - Sistema de Monitoramento",
    smallImageKey: images.smallImageKey || "server",
    smallImageText: texts.smallImageText || "Servidor Ativo",
    startTimestamp: startTime,
    buttons: [
      { 
        label: "Acessar Site", 
        url: urls.site || "http://localhost:3000" 
      },
      { 
        label: "GitHub", 
        url: urls.github || "https://github.com/juliareboucasleite" 
      }
    ]
  }).catch((error) => {
    console.error("❌ Erro ao atualizar atividade:", error.message);
  });
}

rpc.on("disconnected", () => {
  console.log("🔌 Desconectado do Discord Rich Presence");
  isConnected = false;
});

rpc.on("error", (error) => {
  console.error("❌ Erro no Rich Presence:", error.message);
  isConnected = false;
});

process.on("SIGINT", () => {
  console.log("\n🛑 Desconectando Rich Presence...");
  if (isConnected) {
    rpc.destroy();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Desconectando Rich Presence...");
  if (isConnected) {
    rpc.destroy();
  }
  process.exit(0);
});

  console.log("🎯 Iniciando Discord Rich Presence...");
  connectToDiscord();
}

initPresence();
