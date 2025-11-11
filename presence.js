process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// Interceptar console.log para filtrar mensagens do dotenv
const originalConsoleLog = console.log;
console.log = (...args) => {
  const message = args.join(' ');
  if (!message.includes('[dotenv@') && !message.includes('injecting env')) {
    originalConsoleLog(...args);
  }
};

import RPC from "discord-rpc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initPresence() {
  let config = null;
  const configPath = "./config-files/discord-config.js";

  if (fs.existsSync(configPath)) {
    try {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    } catch (error) {
    console.log("Erro ao carregar discord-config.js:", error.message);
    console.log("Usando configuração padrão");
    }
  }

  const clientId = config?.clientId || "SEU_CLIENT_ID_DISCORD";
  const settings = config?.settings || {};
  if (clientId === "SEU_CLIENT_ID_DISCORD" || clientId === "SEU_CLIENT_ID_AQUI") {
    console.log("Configure seu Client ID do Discord:");
    console.log("1. Copie config-files/discord-config.example.js para config-files/discord-config.js");
    console.log("2. Configure seu Client ID em config-files/discord-config.js");
    console.log("3. Acesse: https://discord.com/developers/applications");
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
      console.log("Conectado ao Discord Rich Presence!");
      isConnected = true;
      reconnectAttempts = 0;
    })
    .catch((error) => {
      isConnected = false;
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        // Só mostra log na primeira tentativa e na última
        if (reconnectAttempts === 1 || reconnectAttempts === maxReconnectAttempts) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`Rich Presence: Tentativa de reconexão ${reconnectAttempts}/${maxReconnectAttempts}...`);
          }
        }
        setTimeout(connectToDiscord, reconnectDelay);
      } else {
        if (process.env.NODE_ENV !== 'production') {
          console.log("Rich Presence: Máximo de tentativas atingido. Desabilitado.");
        }
      }
    });
}


rpc.on("ready", () => {
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
    largeImageKey: images.largeImageKey || "promoping",
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
    console.error("Erro ao atualizar atividade:", error.message);
  });
}

rpc.on("disconnected", () => {
  console.log("Desconectado do Discord Rich Presence");
  isConnected = false;
});

rpc.on("error", (error) => {
  console.error("Erro no Rich Presence:", error.message);
  isConnected = false;
});

process.on("SIGINT", () => {
  console.log("\nDesconectando Rich Presence...");
  if (isConnected) {
    rpc.destroy();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nDesconectando Rich Presence...");
  if (isConnected) {
    rpc.destroy();
  }
  process.exit(0);
});

  // Inicia silenciosamente
  connectToDiscord();
}
initPresence();
