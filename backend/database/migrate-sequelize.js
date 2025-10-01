// Script para migrar do sistema atual para Sequelize
import config from './config.js';
import datasource from './datasource.js';

const migrateToSequelize = async () => {
  try {
    console.log('🔄 Iniciando migração para Sequelize...');
    
    // Inicializar o banco de dados
    const db = datasource(config);
    
    // Testar conexão
    await db.sequelize.authenticate();
    console.log('✅ Conexão estabelecida');
    
    // Sincronizar models (criar/atualizar tabelas)
    await db.sequelize.sync({ alter: true });
    console.log('✅ Models sincronizados');
    
    // Exemplo de migração de dados existentes
    console.log('📊 Verificando dados existentes...');
    
    const { models } = db;
    
    // Contar registros existentes
    const productCount = await models.products.count();
    
    console.log(`🛍️ Produtos encontrados: ${productCount}`);
  
    
    return db;
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
};

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateToSequelize()
    .then(() => {
      console.log('🎉 Migração finalizada');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

export default migrateToSequelize;
