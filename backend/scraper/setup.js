/**
 * ⚙️ Script de Configuração do Sistema de Scraping
 * Facilita a configuração inicial do sistema
 */

import { PROXY_CONFIG } from "./proxyConfig.js";
import { testAllProxies } from "./testProxies.js";

/**
 * 🚀 Setup inicial do sistema
 */
async function setupScrapingSystem() {
  console.log("🚀 CONFIGURAÇÃO DO SISTEMA DE SCRAPING");
  console.log("=====================================\n");
  
  // 1. Verificar dependências
  console.log("1️⃣ Verificando dependências...");
  try {
    const puppeteer = await import("puppeteer-extra");
    const stealth = await import("puppeteer-extra-plugin-stealth");
    console.log("✅ Dependências instaladas");
  } catch (err) {
    console.log("❌ Dependências faltando. Execute: npm install puppeteer-extra puppeteer-extra-plugin-stealth");
    return;
  }
  
  // 2. Configurar proxies
  console.log("\n2️⃣ Configurando proxies...");
  const totalProxies = PROXY_CONFIG.free.length + PROXY_CONFIG.premium.length + PROXY_CONFIG.residential.length;
  
  if (totalProxies === 0) {
    console.log("⚠️ Nenhum proxy configurado!");
    console.log("📝 Configure proxies em proxyConfig.js");
    console.log("💡 Proxies gratuitos: https://free-proxy-list.net/");
    console.log("💎 Proxies premium: Bright Data, Oxylabs, Smartproxy");
  } else {
    console.log(`✅ ${totalProxies} proxies configurados`);
    console.log(`🆓 Gratuitos: ${PROXY_CONFIG.free.length}`);
    console.log(`💎 Premium: ${PROXY_CONFIG.premium.length}`);
    console.log(`🏠 Residenciais: ${PROXY_CONFIG.residential.length}`);
  }
  
  // 3. Testar proxies
  if (totalProxies > 0) {
    console.log("\n3️⃣ Testando proxies...");
    await testAllProxies();
  }
  
  // 4. Configurações de stealth
  console.log("\n4️⃣ Configurações de stealth disponíveis:");
  console.log("🟢 Básico - Para sites com pouca proteção");
  console.log("🟡 Médio - Para sites com proteção moderada");
  console.log("🔴 Alto - Para sites com alta proteção");
  console.log("🚀 Extremo - Para sites com proteção máxima");
  
  // 5. Instruções finais
  console.log("\n5️⃣ PRÓXIMOS PASSOS:");
  console.log("📝 1. Configure proxies em proxyConfig.js");
  console.log("🧪 2. Teste proxies: node testProxies.js");
  console.log("🎯 3. Ajuste níveis de stealth em stealthLevels.js");
  console.log("🚀 4. Execute o sistema: npm start");
  
  console.log("\n✅ Setup concluído!");
}

/**
 * 🔧 Configuração rápida para desenvolvimento
 */
async function quickSetup() {
  console.log("⚡ CONFIGURAÇÃO RÁPIDA");
  console.log("=====================\n");
  
  console.log("📝 Para começar rapidamente:");
  console.log("1. Adicione alguns proxies gratuitos em proxyConfig.js");
  console.log("2. Execute: node testProxies.js");
  console.log("3. Inicie o sistema: npm start");
  
  console.log("\n💡 DICAS:");
  console.log("- Use proxies residenciais para melhor performance");
  console.log("- Configure delays maiores para sites protegidos");
  console.log("- Monitore logs para otimizar configurações");
}

/**
 * 📊 Mostra status do sistema
 */
async function showSystemStatus() {
  console.log("📊 STATUS DO SISTEMA");
  console.log("===================\n");
  
  // Dependências
  try {
    await import("puppeteer-extra");
    console.log("✅ puppeteer-extra: OK");
  } catch {
    console.log("❌ puppeteer-extra: FALTANDO");
  }
  
  try {
    await import("puppeteer-extra-plugin-stealth");
    console.log("✅ stealth plugin: OK");
  } catch {
    console.log("❌ stealth plugin: FALTANDO");
  }
  
  // Proxies
  const totalProxies = PROXY_CONFIG.free.length + PROXY_CONFIG.premium.length + PROXY_CONFIG.residential.length;
  console.log(`📊 Proxies configurados: ${totalProxies}`);
  
  // Configurações
  console.log("🛡️ Níveis de stealth: 4 (Básico, Médio, Alto, Extremo)");
  console.log("🔄 Sistema de fallback: 5 camadas");
  console.log("🎯 Lojas suportadas: 11+");
}

// Executar setup se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args[0] === "quick") {
    await quickSetup();
  } else if (args[0] === "status") {
    await showSystemStatus();
  } else {
    await setupScrapingSystem();
  }
}

export { setupScrapingSystem, quickSetup, showSystemStatus };
