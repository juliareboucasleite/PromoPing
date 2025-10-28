#!/usr/bin/env node

/**
 * Script simplificado para configurar sistema de status
 * Executa apenas as tabelas básicas sem procedures complexas
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: join(__dirname, '../../.env'), silent: true, debug: false, override: false, quiet: true });

// ================== CONEXÃO COM BANCO ==================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pap',
  multipleStatements: false // Importante: false para executar uma declaração por vez
};

// ================== FUNÇÃO PRINCIPAL ==================
async function setupStatusSystem() {
  let connection;
  
  try {
    console.log(' Iniciando configuração do sistema de status...');
    
    // Conectar ao banco
    connection = await mysql.createConnection(dbConfig);
    console.log(' Conectado ao banco de dados');
    
    // ================== CRIAR TABELAS ==================
    
    // 1. Tabela métricas_sistema
    console.log(' Criando tabela metricas_sistema...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS metricas_sistema (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        UptimeGeral DECIMAL(5,2) DEFAULT 99.9,
        TempoRespostaMedia INT DEFAULT 45,
        UtilizadoresAtivos INT DEFAULT 0,
        ProdutosMonitorizados INT DEFAULT 0,
        NotificacoesEnviadas INT DEFAULT 0,
        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_data_atualizacao (DataAtualizacao)
      )
    `);
    console.log(' Tabela metricas_sistema criada');
    
    // 2. Tabela status_componentes
    console.log(' Criando tabela status_componentes...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS status_componentes (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Nome VARCHAR(100) NOT NULL,
        Status ENUM('operational', 'degraded', 'outage') DEFAULT 'operational',
        Uptime DECIMAL(5,2) DEFAULT 99.9,
        Latencia INT DEFAULT 0,
        UltimaVerificacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        Detalhes JSON,
        Notas TEXT,
        INDEX idx_status (Status),
        INDEX idx_ultima_verificacao (UltimaVerificacao)
      )
    `);
    console.log(' Tabela status_componentes criada');
    
    // 3. Tabela incidentes
    console.log(' Criando tabela incidentes...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS incidentes (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Titulo VARCHAR(200) NOT NULL,
        Descricao TEXT,
        DataInicio TIMESTAMP NOT NULL,
        DataFim TIMESTAMP NULL,
        Duracao VARCHAR(50),
        Impacto TEXT,
        Status ENUM('investigating', 'identified', 'monitoring', 'resolved') DEFAULT 'investigating',
        ComponenteAfetado VARCHAR(100),
        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_data_inicio (DataInicio),
        INDEX idx_status (Status),
        INDEX idx_componente (ComponenteAfetado)
      )
    `);
    console.log(' Tabela incidentes criada');
    
    // ================== INSERIR DADOS INICIAIS ==================
    
    // Verificar se já existem dados
    const [metricasCount] = await connection.execute("SELECT COUNT(*) as total FROM metricas_sistema");
    const [componentesCount] = await connection.execute("SELECT COUNT(*) as total FROM status_componentes");
    
    if (metricasCount[0].total === 0) {
      console.log(' Inserindo métricas iniciais...');
      await connection.execute(`
        INSERT INTO metricas_sistema (UptimeGeral, TempoRespostaMedia, UtilizadoresAtivos, ProdutosMonitorizados, NotificacoesEnviadas) 
        VALUES (99.9, 45, 0, 0, 0)
      `);
      console.log(' Métricas iniciais inseridas');
    } else {
      console.log(' Métricas já existem');
    }
    
    if (componentesCount[0].total === 0) {
      console.log(' Inserindo componentes do sistema...');
      
      const componentes = [
        ['API Principal', 'operational', 99.9, 45, '{"descricao": "API principal do PromoPing", "versao": "1.0.0"}'],
        ['Monitoramento de Preços', 'operational', 99.7, 120, '{"descricao": "Sistema de monitoramento de preços", "frequencia": "6h"}'],
        ['Sistema de Notificações', 'operational', 99.8, 30, '{"descricao": "Sistema de envio de notificações", "canais": ["email", "discord"]}'],
        ['Banco de Dados', 'operational', 99.95, 5, '{"descricao": "Base de dados MySQL", "tipo": "MySQL 8.0"}'],
        ['Autenticação', 'operational', 99.8, 12, '{"descricao": "Sistema de autenticação JWT", "provedores": ["google", "email"]}'],
        ['Sistema de Pagamentos', 'operational', 99.1, 200, '{"descricao": "Integração com Stripe", "moedas": ["EUR"]}']
      ];
      
      for (const [nome, status, uptime, latencia, detalhes] of componentes) {
        await connection.execute(`
          INSERT INTO status_componentes (Nome, Status, Uptime, Latencia, Detalhes) 
          VALUES (?, ?, ?, ?, ?)
        `, [nome, status, uptime, latencia, detalhes]);
      }
      
      console.log(' Componentes do sistema inseridos');
    } else {
      console.log(' Componentes já existem');
    }
    
    // ================== VERIFICAR RESULTADO ==================
    
    const [metricas] = await connection.execute("SELECT COUNT(*) as total FROM metricas_sistema");
    const [componentes] = await connection.execute("SELECT COUNT(*) as total FROM status_componentes");
    const [incidentes] = await connection.execute("SELECT COUNT(*) as total FROM incidentes");
    
    console.log('\n RESUMO DA CONFIGURAÇÃO:');
    console.log('===========================');
    console.log(` Métricas: ${metricas[0].total} registros`);
    console.log(` Componentes: ${componentes[0].total} registros`);
    console.log(` Incidentes: ${incidentes[0].total} registros`);
    
    console.log('\n Sistema de status configurado com sucesso!');
    console.log('\n PRÓXIMOS PASSOS:');
    console.log('1.  Sistema de status está pronto');
    console.log('2.  APIs de status funcionando');
    console.log('3.  Dashboard de status disponível');
    
  } catch (error) {
    console.error(' Erro ao configurar sistema de status:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  setupStatusSystem().catch(error => {
    console.error(' Erro fatal:', error);
    process.exit(1);
  });
}

export default setupStatusSystem;
