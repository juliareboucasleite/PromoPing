/**
 * 🧪 Script de Teste de Proxies
 * Testa se os proxies estão funcionando
 */

import { PROXY_CONFIG } from "./proxyConfig.js";
import { testProxy, updateProxyStats } from "./proxyManager.js";

/**
 * 🧪 Testa todos os proxies configurados
 */
async function testAllProxies() {
  console.log("🧪 Testando proxies configurados...\n");
  
  const allProxies = [
    ...PROXY_CONFIG.free,
    ...PROXY_CONFIG.premium,
    ...PROXY_CONFIG.residential
  ];
  
  if (allProxies.length === 0) {
    console.log("⚠️ Nenhum proxy configurado!");
    console.log("📝 Configure proxies em proxyConfig.js");
    return;
  }
  
  console.log(`📊 Total de proxies: ${allProxies.length}`);
  console.log(`🆓 Gratuitos: ${PROXY_CONFIG.free.length}`);
  console.log(`💎 Premium: ${PROXY_CONFIG.premium.length}`);
  console.log(`🏠 Residenciais: ${PROXY_CONFIG.residential.length}\n`);
  
  const results = {
    working: [],
    failed: []
  };
  
  for (const proxy of allProxies) {
    console.log(`🔍 Testando: ${proxy}`);
    
    try {
      const isWorking = await testProxy(proxy);
      
      if (isWorking) {
        console.log(`✅ Funcionando: ${proxy}`);
        results.working.push(proxy);
        updateProxyStats(proxy, true);
      } else {
        console.log(`❌ Falhou: ${proxy}`);
        results.failed.push(proxy);
        updateProxyStats(proxy, false);
      }
    } catch (err) {
      console.log(`❌ Erro: ${proxy} - ${err.message}`);
      results.failed.push(proxy);
      updateProxyStats(proxy, false);
    }
    
    // Delay entre testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log("\n📊 RESULTADOS:");
  console.log(`✅ Funcionando: ${results.working.length}`);
  console.log(`❌ Falhando: ${results.failed.length}`);
  
  if (results.working.length > 0) {
    console.log("\n✅ PROXIES FUNCIONANDO:");
    results.working.forEach(proxy => console.log(`  - ${proxy}`));
  }
  
  if (results.failed.length > 0) {
    console.log("\n❌ PROXIES FALHANDO:");
    results.failed.forEach(proxy => console.log(`  - ${proxy}`));
  }
  
  console.log("\n💡 DICAS:");
  console.log("- Remova proxies que falharam");
  console.log("- Adicione mais proxies gratuitos");
  console.log("- Considere proxies premium para melhor performance");
}

/**
 * 🎯 Testa proxy específico
 */
async function testSpecificProxy(proxyUrl) {
  console.log(`🎯 Testando proxy específico: ${proxyUrl}`);
  
  try {
    const isWorking = await testProxy(proxyUrl);
    
    if (isWorking) {
      console.log(`✅ Proxy funcionando: ${proxyUrl}`);
    } else {
      console.log(`❌ Proxy falhando: ${proxyUrl}`);
    }
  } catch (err) {
    console.log(`❌ Erro ao testar proxy: ${err.message}`);
  }
}

/**
 * 📊 Mostra estatísticas dos proxies
 */
function showProxyStats() {
  const { getProxyStats } = await import("./proxyManager.js");
  const stats = getProxyStats();
  
  console.log("📊 ESTATÍSTICAS DOS PROXIES:");
  console.log("================================");
  
  for (const [proxy, stat] of Object.entries(stats)) {
    const total = stat.success + stat.failures;
    const successRate = total > 0 ? (stat.success / total * 100).toFixed(1) : 0;
    
    console.log(`${proxy}:`);
    console.log(`  ✅ Sucessos: ${stat.success}`);
    console.log(`  ❌ Falhas: ${stat.failures}`);
    console.log(`  📈 Taxa de sucesso: ${successRate}%`);
    console.log("");
  }
}

// Executar testes se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args[0] === "specific" && args[1]) {
    await testSpecificProxy(args[1]);
  } else if (args[0] === "stats") {
    await showProxyStats();
  } else {
    await testAllProxies();
  }
}

export { testAllProxies, testSpecificProxy, showProxyStats };
