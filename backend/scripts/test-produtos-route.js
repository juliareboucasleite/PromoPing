import { pool } from '../database/db.js';
import jwt from 'jsonwebtoken';

async function testProdutosRoute() {
  try {
    console.log('🔍 Testando rota de produtos para userId 5...');
    
    // Simular token JWT para userId 5
    const token = jwt.sign({ id: 5 }, 'seu_jwt_secret', { expiresIn: '7d' });
    console.log('🔑 Token gerado:', token);
    
    // Simular a query da rota de produtos
    const [produtos] = await pool.query(
      `SELECT Id, Nome, Link, PrecoAtual, PrecoAlvo, DataCriacao, DataLimite, Loja 
       FROM Produtos 
       WHERE UserId = ?`,
      [5]
    );
    
    console.log(`📊 Produtos encontrados: ${produtos.length}`);
    
    if (produtos.length > 0) {
      console.log('📋 Produtos:');
      produtos.forEach(produto => {
        console.log(`  - ${produto.Nome} (ID: ${produto.Id}) - Preço: €${produto.PrecoAtual}`);
      });
    } else {
      console.log('❌ Nenhum produto encontrado');
    }
    
    // Verificar se o usuário existe
    const [users] = await pool.query(
      'SELECT Id, Nome, Email FROM Utilizadores WHERE Id = ?',
      [5]
    );
    
    if (users.length > 0) {
      console.log('👤 Usuário encontrado:', users[0]);
    } else {
      console.log('❌ Usuário não encontrado');
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar rota de produtos:', error);
  } finally {
    process.exit(0);
  }
}

testProdutosRoute();
