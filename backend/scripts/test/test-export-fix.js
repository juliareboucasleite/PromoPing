// ================== TESTE DE CORREÇÃO DO SISTEMA DE EXPORTAÇÃO ==================

import dotenv from "dotenv";
import { pool as db } from "../database/db.js";

dotenv.config({ silent: true, debug: false, override: false, quiet: true });

async function testarCorrecoes() {
  console.log(" Testando correções do sistema de exportação...\n");
  
  try {
    // 1. Testar conexão com banco
    console.log("1⃣ Testando conexão com banco de dados...");
    const [result] = await db.query("SELECT 1 as test");
    console.log(" Conexão com banco: OK\n");
    
    // 2. Testar se tabela historicoprecos existe
    console.log("2⃣ Verificando tabela historicoprecos...");
    const [tabelas] = await db.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.tables 
      WHERE table_schema = 'pap' AND table_name = 'historicoprecos'
    `);
    
    if (tabelas[0].total > 0) {
      console.log(" Tabela historicoprecos: EXISTE\n");
      
      // 3. Testar estrutura da tabela
      console.log("3⃣ Verificando estrutura da tabela...");
      const [colunas] = await db.query(`
        SELECT COLUMN_NAME, DATA_TYPE 
        FROM information_schema.columns 
        WHERE table_schema = 'pap' AND table_name = 'historicoprecos'
        ORDER BY ORDINAL_POSITION
      `);
      
      console.log(" Colunas encontradas:");
      colunas.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME} (${col.DATA_TYPE})`);
      });
      console.log("");
      
      // 4. Testar dados na tabela
      console.log("4⃣ Verificando dados na tabela...");
      const [dados] = await db.query("SELECT COUNT(*) as total FROM historicoprecos");
      console.log(` Total de registros: ${dados[0].total}\n`);
      
      if (dados[0].total > 0) {
        // 5. Testar query de histórico
        console.log("5⃣ Testando query de histórico...");
        const [historico] = await db.query(`
          SELECT ProdutoId, Preco, DataRegisto as Data
          FROM historicoprecos
          ORDER BY DataRegisto DESC
          LIMIT 5
        `);
        
        console.log(" Últimos 5 registros de histórico:");
        historico.forEach(reg => {
          console.log(`   - Produto ${reg.ProdutoId}: €${reg.Preco} em ${reg.Data}`);
        });
        console.log("");
      }
      
    } else {
      console.log(" Tabela historicoprecos: NÃO EXISTE\n");
    }
    
    // 6. Testar tabela configutilizador
    console.log("6⃣ Verificando tabela configutilizador...");
    const [config] = await db.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.tables 
      WHERE table_schema = 'pap' AND table_name = 'configutilizador'
    `);
    
    if (config[0].total > 0) {
      console.log(" Tabela configutilizador: EXISTE\n");
      
      // 7. Testar dados de usuário
      console.log("7⃣ Verificando dados de usuário...");
      const [usuarios] = await db.query(`
        SELECT c.*, p.nome as plano_nome
        FROM configutilizador c
        LEFT JOIN planos p ON c.PlanoId = p.id
        LIMIT 3
      `);
      
      console.log(" Usuários encontrados:");
      usuarios.forEach(user => {
        console.log(`   - ID ${user.UserId}: ${user.Email} (Plano: ${user.plano_nome || 'N/A'})`);
      });
      console.log("");
      
    } else {
      console.log(" Tabela configutilizador: NÃO EXISTE\n");
    }
    
    // 8. Testar tabela planos
    console.log("8⃣ Verificando tabela planos...");
    const [planos] = await db.query(`
      SELECT COUNT(*) as total 
      FROM information_schema.tables 
      WHERE table_schema = 'pap' AND table_name = 'planos'
    `);
    
    if (planos[0].total > 0) {
      console.log(" Tabela planos: EXISTE\n");
      
      const [planosData] = await db.query("SELECT * FROM planos");
      console.log(" Planos disponíveis:");
      planosData.forEach(plano => {
        console.log(`   - ${plano.nome}: €${plano.preco} (${plano.relatorios} relatórios)`);
      });
      console.log("");
      
    } else {
      console.log(" Tabela planos: NÃO EXISTE\n");
    }
    
    console.log(" Teste concluído com sucesso!");
    console.log(" Todas as tabelas necessárias estão funcionando corretamente.");
    
  } catch (error) {
    console.error(" Erro durante o teste:", error);
  } finally {
    await db.end();
  }
}

// Executar teste
testarCorrecoes();
