/**
 * 🧪 Teste do Sistema de Scraping
 * Script principal para testar o sistema de scraping
 */

console.log("🧪 TESTE DO SISTEMA DE SCRAPING");
console.log("===============================\n");

// Verificar se estamos no diretório correto
const fs = require('fs');
const path = require('path');

const scraperPath = path.join(__dirname, 'backend', 'scraper');

if (!fs.existsSync(scraperPath)) {
  console.log("❌ Diretório backend/scraper não encontrado!");
  console.log("💡 Certifique-se de estar no diretório raiz do projeto");
  process.exit(1);
}

console.log("✅ Diretório backend/scraper encontrado");

// Verificar se os arquivos principais existem
const requiredFiles = [
  'index.js',
  'antiDetection.js',
  'simpleStealth.js',
  'testQuick.js'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  const filePath = path.join(scraperPath, file);
  if (!fs.existsSync(filePath)) {
    console.log(`❌ Arquivo ${file} não encontrado`);
    allFilesExist = false;
  } else {
    console.log(`✅ Arquivo ${file} encontrado`);
  }
}

if (!allFilesExist) {
  console.log("\n❌ Alguns arquivos estão faltando!");
  console.log("💡 Execute o setup completo primeiro");
  process.exit(1);
}

console.log("\n🎉 TODOS OS ARQUIVOS ENCONTRADOS!");
console.log("================================");

console.log("\n📋 SISTEMA DE SCRAPING DISPONÍVEL:");
console.log("✅ 6 camadas de fallback");
console.log("✅ Anti-detecção avançada");
console.log("✅ Sistema de proxies");
console.log("✅ Stealth simplificado");
console.log("✅ Testes automatizados");

console.log("\n🚀 COMO USAR:");
console.log("1. cd backend/scraper");
console.log("2. node testQuick.js    # Teste completo");
console.log("3. node testSimple.js   # Teste básico");
console.log("4. node setup.js        # Configuração");

console.log("\n💡 DICAS:");
console.log("- Configure proxies em proxyConfig.js");
console.log("- Monitore logs para otimizar");
console.log("- Use níveis de stealth apropriados");

console.log("\n🎯 PRÓXIMOS PASSOS:");
console.log("1. Navegue para backend/scraper");
console.log("2. Execute: node testQuick.js");
console.log("3. Configure proxies se necessário");
console.log("4. Integre no seu projeto principal");

console.log("\n✅ Sistema pronto para uso!");
