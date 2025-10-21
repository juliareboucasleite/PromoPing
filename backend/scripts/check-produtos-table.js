import { pool } from '../database/db.js';

async function checkProdutosTable() {
  try {
    console.log('🔍 Verificando estrutura da tabela Produtos...');
    
    // Verificar estrutura da tabela
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'pap' AND TABLE_NAME = 'Produtos'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Colunas da tabela Produtos:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });
    
    // Verificar dados de exemplo
    const [rows] = await pool.query('SELECT * FROM Produtos WHERE UserId = 5 LIMIT 1');
    if (rows.length > 0) {
      console.log('📄 Exemplo de produto:', rows[0]);
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar tabela Produtos:', error);
  } finally {
    process.exit(0);
  }
}

checkProdutosTable();
