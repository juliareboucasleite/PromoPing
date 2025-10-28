import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar configuração do banco
import { pool } from '../database/db.js';

async function setupStripeTable() {
  try {
    console.log(' Configurando tabela stripe_subscriptions...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '../database/migrations/create_stripe_subscriptions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar a migração
    await pool.query(sqlContent);
    
    console.log(' Tabela stripe_subscriptions criada com sucesso!');
    
    // Verificar se a tabela foi criada
    const [tables] = await pool.query("SHOW TABLES LIKE 'stripe_subscriptions'");
    
    if (tables.length > 0) {
      console.log(' Tabela verificada e funcionando!');
      
      // Mostrar estrutura da tabela
      const [structure] = await pool.query("DESCRIBE stripe_subscriptions");
      console.log(' Estrutura da tabela:');
      structure.forEach(column => {
        console.log(`  - ${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    } else {
      console.log(' Erro: Tabela não foi criada');
    }
    
  } catch (error) {
    console.error(' Erro ao configurar tabela:', error);
  } finally {
    // Fechar conexão
    await pool.end();
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  setupStripeTable();
}

export default setupStripeTable;
