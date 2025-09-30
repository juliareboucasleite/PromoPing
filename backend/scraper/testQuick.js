/**
 * 🧪 Teste Rápido do Sistema de Scraping
 * Verifica se o sistema está funcionando sem erros
 */

import { scrapeProduct } from "./index.js";

/**
 * 🎯 Teste básico do sistema
 */
async function testBasic() {
  console.log("🧪 TESTE BÁSICO DO SISTEMA");
  console.log("==========================\n");
  
  const testUrl = "https://www.worten.pt/produtos/iphone-15-apple-128gb-preto-1234567";
  
  console.log(`🔍 Testando URL: ${testUrl}`);
  console.log("⏳ Aguarde...\n");
  
  try {
    const startTime = Date.now();
    const result = await scrapeProduct(testUrl);
    const endTime = Date.now();
    
    console.log("📊 RESULTADO:");
    console.log(`✅ Sucesso: ${result.success}`);
    console.log(`💰 Preço: ${result.price || 'N/A'}`);
    console.log(`📦 Produto: ${result.title || 'N/A'}`);
    console.log(`🏪 Loja: ${result.loja || 'N/A'}`);
    console.log(`🛡️ Método: ${result.method || 'N/A'}`);
    console.log(`⏱️ Tempo: ${endTime - startTime}ms`);
    
    if (result.success) {
      console.log("\n🎉 SISTEMA FUNCIONANDO!");
    } else {
      console.log("\n⚠️ Sistema funcionando, mas preço não encontrado");
      console.log("💡 Isso pode ser normal para URLs de teste");
    }
    
  } catch (err) {
    console.log(`\n❌ ERRO: ${err.message}`);
    console.log("🔧 Verifique as dependências e configurações");
  }
}

/**
 * 🎯 Teste de diferentes lojas
 */
async function testStores() {
  console.log("🧪 TESTE DE DIFERENTES LOJAS");
  console.log("============================\n");
  
  const testUrls = [
    { name: "Worten", url: "https://www.worten.pt/produtos/teste" },
    { name: "FNAC", url: "https://www.fnac.pt/produto-teste" },
    { name: "Amazon", url: "https://www.amazon.pt/dp/teste" }
  ];
  
  for (const store of testUrls) {
    console.log(`🔍 Testando ${store.name}: ${store.url}`);
    
    try {
      const result = await scrapeProduct(store.url);
      
      if (result.success) {
        console.log(`   ✅ ${store.name}: Funcionando`);
      } else {
        console.log(`   ⚠️ ${store.name}: Sistema OK, preço não encontrado`);
      }
    } catch (err) {
      console.log(`   ❌ ${store.name}: Erro - ${err.message}`);
    }
    
    console.log(""); // Linha em branco
  }
}

/**
 * 🎯 Teste de performance
 */
async function testPerformance() {
  console.log("🧪 TESTE DE PERFORMANCE");
  console.log("======================\n");
  
  const testUrl = "https://www.worten.pt/produtos/iphone-15-apple-128gb-preto-1234567";
  const iterations = 3;
  
  console.log(`🔄 Executando ${iterations} iterações...\n`);
  
  const times = [];
  
  for (let i = 1; i <= iterations; i++) {
    console.log(`📊 Iteração ${i}/${iterations}:`);
    
    try {
      const startTime = Date.now();
      const result = await scrapeProduct(testUrl);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      times.push(duration);
      
      console.log(`   ⏱️ Tempo: ${duration}ms`);
      console.log(`   ✅ Sucesso: ${result.success}`);
      console.log(`   🛡️ Método: ${result.method || 'N/A'}`);
      
    } catch (err) {
      console.log(`   ❌ Erro: ${err.message}`);
    }
    
    console.log(""); // Linha em branco
  }
  
  if (times.length > 0) {
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    console.log("📈 ESTATÍSTICAS DE PERFORMANCE:");
    console.log(`⏱️ Tempo médio: ${Math.round(avgTime)}ms`);
    console.log(`⚡ Tempo mínimo: ${minTime}ms`);
    console.log(`🐌 Tempo máximo: ${maxTime}ms`);
  }
}

/**
 * 🎯 Menu de testes
 */
async function runTests() {
  console.log("🧪 SISTEMA DE SCRAPING - TESTES");
  console.log("===============================\n");
  
  console.log("Escolha um teste:");
  console.log("1️⃣ Básico - Teste simples");
  console.log("2️⃣ Lojas - Teste diferentes lojas");
  console.log("3️⃣ Performance - Teste de velocidade");
  console.log("4️⃣ Todos - Executar todos os testes");
  
  // Simular escolha (em produção, usar readline)
  const escolha = "1"; // Teste básico
  
  switch (escolha) {
    case "1":
      await testBasic();
      break;
    case "2":
      await testStores();
      break;
    case "3":
      await testPerformance();
      break;
    case "4":
      await testBasic();
      console.log("\n" + "=".repeat(50) + "\n");
      await testStores();
      console.log("\n" + "=".repeat(50) + "\n");
      await testPerformance();
      break;
    default:
      console.log("❌ Opção inválida");
  }
  
  console.log("\n🎉 Testes concluídos!");
  console.log("💡 Para mais informações, consulte README.md");
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  await runTests();
}

export { testBasic, testStores, testPerformance, runTests };
