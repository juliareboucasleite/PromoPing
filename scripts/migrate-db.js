#!/usr/bin/env node

import { pool } from '../backend/database/db.js';

async function addColumnIfNotExists(table, column, definition) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name=? AND column_name=?",
    [table, column]
  );
  if (rows[0].count === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(` Coluna ${column} adicionada à tabela ${table}`);
  }
}

async function migrate() {
  console.log(' Iniciando migração...');

  // Atualizar tabela utilizadores
  await addColumnIfNotExists('utilizadores', 'discord_id', 'VARCHAR(50) UNIQUE');
  await addColumnIfNotExists('utilizadores', 'ultimo_login', 'TIMESTAMP NULL');
  await addColumnIfNotExists('utilizadores', 'ativo', 'BOOLEAN DEFAULT TRUE');

  // Criar HistoricoPrecos alinhado com a base atual (tabelas camel-case)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS HistoricoPrecos (
      Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      ProdutoId INT UNSIGNED NOT NULL,
      Preco DECIMAL(10,2) NOT NULL,
      DataRegistro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE
    )
  `);
  console.log(' Tabela HistoricoPrecos verificada/criada');

  // Adicionar coluna Loja à tabela Produtos
  await addColumnIfNotExists('Produtos', 'Loja', "VARCHAR(60) NULL");
  console.log(' Coluna Loja verificada/criada em Produtos');

  // Adicionar colunas de estatísticas à tabela utilizadores
  await addColumnIfNotExists('utilizadores', 'telefone', "VARCHAR(20) NULL");
  await addColumnIfNotExists('utilizadores', 'dinheiro_poupado', "DECIMAL(10,2) DEFAULT 0.00");
  console.log(' Colunas de estatísticas verificadas/criadas em utilizadores');

  // Criar tabela de contas conectadas
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ContasConectadas (
      Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      UserId INT UNSIGNED NOT NULL,
      Tipo ENUM('google','discord','telegram','whatsapp') NOT NULL,
      Identificador VARCHAR(255) NOT NULL,
      Conectado BOOLEAN DEFAULT TRUE,
      DataConexao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_tipo (UserId, Tipo)
    )
  `);
  console.log(' Tabela ContasConectadas verificada/criada');

  // Criar tabela de preferências de notificação
  await pool.query(`
    CREATE TABLE IF NOT EXISTS PreferenciasNotificacao (
      Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      UserId INT UNSIGNED NOT NULL,
      Tipo ENUM('email','discord','telegram','whatsapp') NOT NULL,
      Ativo BOOLEAN DEFAULT TRUE,
      FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_tipo (UserId, Tipo)
    )
  `);
  console.log(' Tabela PreferenciasNotificacao verificada/criada');

  // Criar Notificacoes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS Notificacoes (
      Id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      UserId INT UNSIGNED NOT NULL,
      ProdutoId INT UNSIGNED,
      Tipo ENUM('discord','email','whatsapp') NOT NULL,
      Mensagem TEXT NOT NULL,
      Enviada BOOLEAN DEFAULT FALSE,
      DataEnvio TIMESTAMP NULL,
      CriadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ValorPoupado DECIMAL(10,2) NULL,
      FOREIGN KEY (UserId) REFERENCES utilizadores(id) ON DELETE CASCADE,
      FOREIGN KEY (ProdutoId) REFERENCES Produtos(Id) ON DELETE CASCADE
    )
  `);
  console.log(' Tabela Notificacoes verificada/criada');

  // Adicionar coluna ValorPoupado se não existir (para tabelas já existentes)
  await addColumnIfNotExists('Notificacoes', 'ValorPoupado', 'DECIMAL(10,2) NULL');
  console.log(' Coluna ValorPoupado verificada/criada em Notificacoes');

  await pool.end();
  console.log(' Migração concluída!');
}

migrate().catch(err => {
  console.error(' Erro na migração:', err.message);
  process.exit(1);
});
