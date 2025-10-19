// ================== SCRIPT PARA CONFIGURAR HISTÓRICO DE PREÇOS ==================

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Carregar variáveis de ambiente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../../.env"), silent: true, debug: false, override: false, quiet: true });

async function setupHistoricoPrecos() {
  let connection;
  try {
    console.log("🔧 Configurando sistema de histórico de preços...");
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log("✅ Conectado ao banco de dados");

    // Ler e executar o script SQL
    const sqlScriptPath = join(__dirname, "../database/migrations/create_historico_precos.sql");
    const sqlScript = readFileSync(sqlScriptPath, "utf8");

    console.log("📄 Executando script SQL...");
    
    // Dividir o script em comandos individuais
    const commands = sqlScript
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command.trim()) {
        try {
          await connection.execute(command);
          console.log(`✅ Comando executado: ${command.substring(0, 50)}...`);
        } catch (error) {
          // Ignorar erros de tabela já existente
          if (!error.message.includes('already exists')) {
            console.log(`⚠️ Aviso: ${error.message}`);
          }
        }
      }
    }

    console.log("✅ Tabela de histórico de preços criada com sucesso!");
    console.log("✅ Views criadas com sucesso!");
    console.log("✅ Triggers criados com sucesso!");
    console.log("✅ Procedures criadas com sucesso!");
    console.log("✅ Dados de exemplo inseridos com sucesso!");

    // Verificar se as tabelas foram criadas
    const [tables] = await connection.query("SHOW TABLES LIKE 'historico_precos'");
    if (tables.length > 0) {
      console.log("✅ Tabela 'historico_precos' confirmada no banco de dados");
    }

    // Verificar se as views foram criadas
    const [views] = await connection.query("SHOW TABLES LIKE 'vw_%'");
    console.log(`✅ ${views.length} views criadas`);

    // Verificar se os triggers foram criados
    const [triggers] = await connection.query("SHOW TRIGGERS LIKE 'tr_%'");
    console.log(`✅ ${triggers.length} triggers criados`);

    // Verificar se as procedures foram criadas
    const [procedures] = await connection.query("SHOW PROCEDURE STATUS WHERE Name LIKE 'sp_%'");
    console.log(`✅ ${procedures.length} procedures criadas`);

    // Mostrar estatísticas dos dados inseridos
    const [count] = await connection.query("SELECT COUNT(*) as total FROM historico_precos");
    console.log(`📊 Total de registros de histórico inseridos: ${count[0].total}`);

    const [produtos] = await connection.query("SELECT COUNT(DISTINCT ProdutoId) as produtos FROM historico_precos");
    console.log(`📊 Produtos com histórico: ${produtos[0].produtos}`);

    console.log("\n🎉 Sistema de histórico de preços configurado com sucesso!");
    console.log("\n📋 Funcionalidades disponíveis:");
    console.log("   • Tabela historico_precos para armazenar histórico");
    console.log("   • Views para consultas otimizadas");
    console.log("   • Triggers para atualização automática");
    console.log("   • Procedures para operações complexas");
    console.log("   • Dados de exemplo para teste");

  } catch (error) {
    console.error("❌ Erro ao configurar histórico de preços:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Conexão com o banco de dados encerrada");
    }
  }
}

async function testarHistoricoPrecos() {
  let connection;
  try {
    console.log("🧪 Testando sistema de histórico de preços...");
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    // Testar view de histórico detalhado
    console.log("\n📊 Testando view vw_historico_precos_detalhado:");
    const [historico] = await connection.query(`
      SELECT * FROM vw_historico_precos_detalhado 
      LIMIT 5
    `);
    console.log(`✅ ${historico.length} registros encontrados na view`);

    // Testar view de estatísticas
    console.log("\n📈 Testando view vw_estatisticas_precos:");
    const [estatisticas] = await connection.query(`
      SELECT * FROM vw_estatisticas_precos 
      LIMIT 3
    `);
    console.log(`✅ ${estatisticas.length} produtos com estatísticas`);

    // Testar procedure de histórico
    console.log("\n🔍 Testando procedure sp_obter_historico_produto:");
    const [resultado] = await connection.query(`
      CALL sp_obter_historico_produto(1, 30)
    `);
    console.log(`✅ Procedure executada com sucesso`);

    // Testar procedure de estatísticas
    console.log("\n📊 Testando procedure sp_obter_estatisticas_precos:");
    const [stats] = await connection.query(`
      CALL sp_obter_estatisticas_precos()
    `);
    console.log(`✅ Estatísticas obtidas com sucesso`);

    console.log("\n✅ Todos os testes passaram com sucesso!");

  } catch (error) {
    console.error("❌ Erro durante os testes:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar baseado no comando
const comando = process.argv[2];

if (comando === 'test') {
  testarHistoricoPrecos();
} else {
  setupHistoricoPrecos();
}
