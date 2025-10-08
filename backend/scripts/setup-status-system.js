import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// ================== CONFIGURAÇÃO ==================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../../.env') });

// ================== CONEXÃO COM BANCO ==================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'promoping',
  multipleStatements: true
};

// ================== FUNÇÃO PRINCIPAL ==================
async function setupStatusSystem() {
  let connection;
  
  try {
    console.log('🚀 Iniciando configuração do sistema de status...');
    
    // Conectar ao banco
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado ao banco de dados');
    
    // Ler arquivo SQL
    const sqlFile = path.join(__dirname, '../database/migrations/create_status_tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('📄 Executando migrações SQL...');
    
    // Executar SQL
    await connection.execute(sqlContent);
    console.log('✅ Migrações executadas com sucesso');
    
    // Verificar se as tabelas foram criadas
    const [tables] = await connection.execute("SHOW TABLES LIKE '%status%' OR SHOW TABLES LIKE '%metricas%' OR SHOW TABLES LIKE '%incidentes%'");
    console.log('📊 Tabelas criadas:', tables.map(t => Object.values(t)[0]));
    
    // Verificar dados iniciais
    const [metricas] = await connection.execute("SELECT COUNT(*) as total FROM metricas_sistema");
    const [componentes] = await connection.execute("SELECT COUNT(*) as total FROM status_componentes");
    const [incidentes] = await connection.execute("SELECT COUNT(*) as total FROM incidentes");
    
    console.log('📈 Dados iniciais inseridos:');
    console.log(`   - Métricas: ${metricas[0].total} registros`);
    console.log(`   - Componentes: ${componentes[0].total} registros`);
    console.log(`   - Incidentes: ${incidentes[0].total} registros`);
    
    // Testar nova API de componentes
    console.log('🔧 Testando API de componentes...');
    const [componenteTeste] = await connection.execute("SELECT * FROM status_componentes WHERE Id = 1");
    console.log('✅ Componente de teste:', componenteTeste[0]);
    
    // Testar as views
    console.log('🔍 Testando views...');
    const [statusGeral] = await connection.execute("SELECT * FROM v_status_geral");
    console.log('✅ View v_status_geral funcionando:', statusGeral[0]);
    
    const [incidentesAtivos] = await connection.execute("SELECT * FROM v_incidentes_ativos");
    console.log('✅ View v_incidentes_ativos funcionando:', incidentesAtivos.length, 'incidentes ativos');
    
    // Testar procedures
    console.log('🔧 Testando procedures...');
    await connection.execute("CALL sp_atualizar_metricas(99.8, 50, 100, 500, 25)");
    console.log('✅ Procedure sp_atualizar_metricas funcionando');
    
    console.log('🎉 Sistema de status configurado com sucesso!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('   1. Reinicie o servidor PromoPing');
    console.log('   2. Acesse /api/status para testar a API');
    console.log('   3. Visite a página de Status do Serviço');
    console.log('   4. Configure cron jobs para atualizações automáticas');
    
  } catch (error) {
    console.error('❌ Erro ao configurar sistema de status:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco encerrada');
    }
  }
}

// ================== FUNÇÃO DE TESTE ==================
async function testStatusAPI() {
  let connection;
  
  try {
    console.log('🧪 Testando API de status...');
    
    connection = await mysql.createConnection(dbConfig);
    
    // Testar consulta principal
    const [metricas] = await connection.execute("SELECT * FROM metricas_sistema ORDER BY Id DESC LIMIT 1");
    const [componentes] = await connection.execute("SELECT * FROM status_componentes ORDER BY Id ASC");
    const [incidentes] = await connection.execute("SELECT * FROM incidentes ORDER BY DataInicio DESC LIMIT 5");
    
    console.log('✅ Consultas funcionando:');
    console.log(`   - Métricas: ${metricas.length} registros`);
    console.log(`   - Componentes: ${componentes.length} registros`);
    console.log(`   - Incidentes: ${incidentes.length} registros`);
    
    // Simular dados de teste
    const testData = {
      metricas: metricas[0] || {},
      componentes,
      incidentes,
      ultimaAtualizacao: new Date().toISOString()
    };
    
    console.log('📊 Dados de teste:', JSON.stringify(testData, null, 2));
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// ================== EXECUÇÃO ==================
const command = process.argv[2];

if (command === 'test') {
  testStatusAPI();
} else {
  setupStatusSystem();
}
