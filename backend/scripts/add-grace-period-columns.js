import { pool as db } from '../database/db.js';

async function addGracePeriodColumns() {
  try {
    console.log(' Adicionando colunas para período de graça...');
    
    // Adicionar coluna grace_period_end
    await db.query(`
      ALTER TABLE stripe_subscriptions 
      ADD COLUMN grace_period_end TIMESTAMP NULL
    `);
    console.log(' Coluna grace_period_end adicionada');
    
    // Adicionar coluna cancellation_reason
    await db.query(`
      ALTER TABLE stripe_subscriptions 
      ADD COLUMN cancellation_reason VARCHAR(255) NULL
    `);
    console.log(' Coluna cancellation_reason adicionada');
    
    console.log(' Colunas adicionadas com sucesso!');
    
    // Verificar estrutura atualizada
    const [structure] = await db.query('DESCRIBE stripe_subscriptions');
    console.log('\n Nova estrutura da tabela:');
    structure.forEach(column => {
      console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    await db.end();
  } catch (error) {
    console.error(' Erro ao adicionar colunas:', error.message);
    process.exit(1);
  }
}

addGracePeriodColumns();
