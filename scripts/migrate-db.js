#!/usr/bin/env node

import { pool } from '../backend/db.js';

async function addColumnIfNotExists(table, column, definition) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name=? AND column_name=?",
    [table, column]
  );
  if (rows[0].count === 0) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✅ Coluna ${column} adicionada à tabela ${table}`);
  }
}

async function migrate() {
  console.log('🔄 Iniciando migração...');

  // Atualizar tabela utilizadores
  await addColumnIfNotExists('utilizadores', 'discord_id', 'VARCHAR(50) UNIQUE');
  await addColumnIfNotExists('utilizadores', 'ultimo_login', 'TIMESTAMP NULL');
  await addColumnIfNotExists('utilizadores', 'ativo', 'BOOLEAN DEFAULT TRUE');

  // Criar historico_precos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS historico_precos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      preco DECIMAL(10,2) NOT NULL,
      data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Tabela historico_precos verificada/criada');

  // Criar notificacoes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      produto_id INT,
      tipo ENUM('discord','email','whatsapp') NOT NULL,
      mensagem TEXT NOT NULL,
      enviada BOOLEAN DEFAULT FALSE,
      data_envio TIMESTAMP NULL,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ Tabela notificacoes verificada/criada');

  await pool.end();
  console.log('🎉 Migração concluída!');
}

migrate().catch(err => {
  console.error('❌ Erro na migração:', err.message);
  process.exit(1);
});
