import { pool } from "../database/db.js";
import { scrapeProduct } from "../scraper/index.js";
import { formatPrice } from "../utils/format.js";
import { processAlerts } from "./alerts.js";

/**
 * 🔍 Serviço de monitoramento automático de preços
 * Executa scraping periódico de todos os produtos cadastrados
 */

/**
 * 📊 Monitora um produto específico
 * @param {Object} product - Dados do produto
 * @returns {Object|null} - Resultado do monitoramento
 */
async function monitorProduct(product) {
  try {
    console.log(`🔍 Monitorando produto: ${product.Nome} (${product.Loja})`);
    
    // Executar scraping com sistema inteligente
    const scrapedData = await scrapeProduct(product.Link);
    
    if (!scrapedData || !scrapedData.success || !scrapedData.price) {
      console.log(`⚠️ Não foi possível obter preço para ${product.Nome}`);
      return null;
    }
    
    const novoPreco = formatPrice(scrapedData.price);
    const precoAtual = formatPrice(product.PrecoAtual);
    
    // Verificar se o preço mudou
    if (novoPreco === precoAtual) {
      console.log(`✅ Preço inalterado para ${product.Nome}: €${novoPreco}`);
      return { status: 'unchanged', preco: novoPreco };
    }
    
    // Atualizar preço atual
    await pool.query(
      "UPDATE Produtos SET PrecoAtual = ?, PrecoAnterior = ? WHERE Id = ?",
      [novoPreco, precoAtual, product.Id]
    );
    
    // Adicionar ao histórico
    await pool.query(
      "INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) VALUES (?, ?, NOW())",
      [product.Id, novoPreco]
    );
    
    console.log(`📈 Preço atualizado para ${product.Nome}: €${precoAtual} → €${novoPreco}`);
    
    // Verificar se atingiu preço alvo
    const precoAlvo = formatPrice(product.PrecoAlvo);
    const atingiuAlvo = precoAlvo && novoPreco <= precoAlvo;
    
    // Processar alertas
    await processAlerts(product, novoPreco, precoAtual);
    
    return {
      status: 'updated',
      preco: novoPreco,
      precoAnterior: precoAtual,
      atingiuAlvo,
      produto: product
    };
    
  } catch (error) {
    console.error(`❌ Erro ao monitorar ${product.Nome}:`, error.message);
    return null;
  }
}

/**
 * 🚀 Executa monitoramento de todos os produtos
 * @returns {Object} - Estatísticas do monitoramento
 */
export async function runPriceMonitoring() {
  try {
    console.log("🔄 Iniciando monitoramento de preços...");
    
    // Buscar todos os produtos ativos
    const [products] = await pool.query(`
      SELECT Id, Nome, Link, PrecoAtual, PrecoAlvo, Loja, UserId
      FROM Produtos 
      WHERE Link IS NOT NULL AND Link != ''
      ORDER BY Id
    `);
    
    if (products.length === 0) {
      console.log("ℹ️ Nenhum produto para monitorar");
      return { total: 0, updated: 0, errors: 0, targets: 0 };
    }
    
    console.log(`📦 Monitorando ${products.length} produtos...`);
    
    let updated = 0;
    let errors = 0;
    let targets = 0;
    const results = [];
    
    // Monitorar cada produto
    for (const product of products) {
      const result = await monitorProduct(product);
      
      if (result) {
        if (result.status === 'updated') {
          updated++;
          results.push(result);
          
          if (result.atingiuAlvo) {
            targets++;
            console.log(`🎯 PREÇO ALVO ATINGIDO: ${product.Nome} - €${result.preco}`);
          }
        }
      } else {
        errors++;
      }
      
      // Pequena pausa entre requests para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const stats = {
      total: products.length,
      updated,
      errors,
      targets,
      results
    };
    
    console.log("📊 Estatísticas do monitoramento:");
    console.log(`   Total: ${stats.total}`);
    console.log(`   Atualizados: ${stats.updated}`);
    console.log(`   Erros: ${stats.errors}`);
    console.log(`   Preços alvo atingidos: ${stats.targets}`);
    
    return stats;
    
  } catch (error) {
    console.error("❌ Erro no monitoramento:", error.message);
    throw error;
  }
}

/**
 * ⏰ Inicia monitoramento automático
 * @param {number} intervalMinutes - Intervalo em minutos (padrão: 30)
 */
export function startPriceMonitoring(intervalMinutes = 30) {
  console.log(`⏰ Iniciando monitoramento automático (${intervalMinutes}min)`);
  
  // Executar imediatamente
  runPriceMonitoring().catch(err => 
    console.error("❌ Erro na execução inicial:", err.message)
  );
  
  // Agendar execuções periódicas
  const intervalMs = intervalMinutes * 60 * 1000;
  
  return setInterval(() => {
    runPriceMonitoring().catch(err => 
      console.error("❌ Erro no monitoramento periódico:", err.message)
    );
  }, intervalMs);
}

/**
 * 🛑 Para o monitoramento automático
 * @param {Object} intervalRef - Referência do interval
 */
export function stopPriceMonitoring(intervalRef) {
  if (intervalRef) {
    clearInterval(intervalRef);
    console.log("🛑 Monitoramento automático parado");
  }
}

/**
 * 📊 Obtém estatísticas de monitoramento
 * @returns {Object} - Estatísticas dos últimos 24h
 */
export async function getMonitoringStats() {
  try {
    const [stats] = await pool.query(`
      SELECT 
        COUNT(*) as total_produtos,
        COUNT(CASE WHEN PrecoAtual IS NOT NULL THEN 1 END) as produtos_com_preco,
        COUNT(CASE WHEN PrecoAlvo IS NOT NULL AND PrecoAtual <= PrecoAlvo THEN 1 END) as produtos_alvo_atingido
      FROM Produtos
    `);
    
    const [recentUpdates] = await pool.query(`
      SELECT COUNT(*) as atualizacoes_24h
      FROM HistoricoPrecos 
      WHERE DataRegisto >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    return {
      ...stats[0],
      ...recentUpdates[0],
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error("❌ Erro ao obter estatísticas:", error.message);
    return null;
  }
}
