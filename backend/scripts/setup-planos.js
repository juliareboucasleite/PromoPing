import { pool } from '../database/db.js';

async function setupPlanos() {
  try {
    console.log('🔍 Verificando tabela planos...');
    
    // Verificar se a tabela existe
    const [tables] = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'pap' AND table_name = 'planos'
    `);
    
    if (tables[0].count === 0) {
      console.log('📝 Criando tabela planos...');
      
      await pool.query(`
        CREATE TABLE planos (
          Id INT AUTO_INCREMENT PRIMARY KEY,
          Nome VARCHAR(50) NOT NULL,
          Preco DECIMAL(10,2) NOT NULL,
          LimiteProdutos INT NOT NULL,
          PermiteSMS BOOLEAN DEFAULT FALSE,
          Relatorios BOOLEAN DEFAULT FALSE,
          DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ Tabela planos criada!');
    } else {
      console.log('✅ Tabela planos já existe!');
    }
    
    // Verificar se há dados
    const [planos] = await pool.query('SELECT COUNT(*) as count FROM planos');
    
    if (planos[0].count === 0) {
      console.log('📝 Inserindo planos padrão...');
      
      await pool.query(`
        INSERT INTO planos (Nome, Preco, LimiteProdutos, PermiteSMS, Relatorios) VALUES
        ('Free', 0.00, 5, FALSE, FALSE),
        ('Basic', 9.99, 25, TRUE, FALSE),
        ('Standard', 19.99, 100, TRUE, TRUE),
        ('Premium', 39.99, 999, TRUE, TRUE)
      `);
      
      console.log('✅ Planos inseridos!');
    } else {
      console.log('✅ Planos já existem!');
    }
    
    // Listar planos
    const [planosList] = await pool.query('SELECT * FROM planos');
    console.log('📋 Planos disponíveis:');
    planosList.forEach(plano => {
      console.log(`  - ${plano.Nome}: €${plano.Preco} (${plano.LimiteProdutos} produtos)`);
    });
    
    console.log('✅ Setup de planos concluído!');
    
  } catch (error) {
    console.error('❌ Erro no setup de planos:', error);
  } finally {
    process.exit(0);
  }
}

setupPlanos();
