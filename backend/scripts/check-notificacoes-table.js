import { pool } from '../database/db.js';

async function checkNotificacoesTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela Notificacoes...');
    
    // Verificar estrutura da tabela
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pap' AND TABLE_NAME = 'Notificacoes'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Colunas da tabela Notificacoes:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });
    
    // Verificar se há dados
    const [rows] = await pool.query('SELECT COUNT(*) as count FROM Notificacoes');
    console.log(`📊 Total de notificações: ${rows[0].count}`);
    
    if (rows[0].count > 0) {
      const [sample] = await pool.query('SELECT * FROM Notificacoes LIMIT 1');
      console.log('📄 Exemplo de notificação:', sample[0]);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela Notificacoes:', error);
  } finally {
    process.exit(0);
  }
}

checkNotificacoesTable();
