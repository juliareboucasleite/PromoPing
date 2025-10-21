import { pool } from '../database/db.js';

async function checkUserProducts() {
  try {
    console.log('🔍 Verificando produtos do usuário 5...');
    
    // Verificar produtos
    const [produtos] = await pool.query(
      'SELECT * FROM Produtos WHERE UserId = 5'
    );
    
    console.log(`📊 Total de produtos para userId 5: ${produtos.length}`);
    
    if (produtos.length > 0) {
      console.log('📋 Produtos encontrados:');
      produtos.forEach(produto => {
        console.log(`  - ${produto.Nome} (ID: ${produto.Id}) - Preço: €${produto.PrecoAtual}`);
      });
    } else {
      console.log('❌ Nenhum produto encontrado para userId 5');
    }
    
    // Verificar configuração do usuário
    const [config] = await pool.query(
      'SELECT * FROM ConfigUtilizador WHERE UserId = 5'
    );
    
    console.log('⚙️ Configuração do usuário:');
    if (config.length > 0) {
      console.log(`  - PlanoAtualId: ${config[0].PlanoAtualId}`);
      console.log(`  - LimiteProdutos: ${config[0].LimiteProdutos}`);
      console.log(`  - CanalPreferido: ${config[0].CanalPreferido}`);
    } else {
      console.log('❌ Nenhuma configuração encontrada para userId 5');
    }
    
    // Verificar plano
    if (config.length > 0) {
      const [plano] = await pool.query(
        'SELECT * FROM planos WHERE Id = ?',
        [config[0].PlanoAtualId]
      );
      
      if (plano.length > 0) {
        console.log(`📦 Plano atual: ${plano[0].Nome} (ID: ${plano[0].Id})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar produtos:', error);
  } finally {
    process.exit(0);
  }
}

checkUserProducts();
