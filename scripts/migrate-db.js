#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

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

async function columnExists(table, column) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) as count FROM information_schema.columns WHERE table_schema = DATABASE() AND LOWER(table_name)=LOWER(?) AND column_name=?",
    [table, column]
  );
  return Number(rows[0].count) > 0;
}

async function dropColumnIfExists(table, column) {
  const exists = await columnExists(table, column);
  if (exists) {
    await pool.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    console.log(` Coluna ${column} removida da tabela ${table}`);
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

  // Unificar dinheiro poupado: ficar só com dinheiro_poupado, remover DinheiroPoupado se existir
  if (await columnExists('utilizadores', 'DinheiroPoupado')) {
    await pool.query(
      "UPDATE utilizadores SET dinheiro_poupado = COALESCE(DinheiroPoupado, dinheiro_poupado, 0)"
    );
    console.log(' Valores de DinheiroPoupado copiados para dinheiro_poupado');
    await dropColumnIfExists('utilizadores', 'DinheiroPoupado');
  }

  // Sincronizar dinheiro_poupado a partir das notificações já existentes (fonte de verdade histórica)
  try {
    const [updated] = await pool.query(`
      UPDATE utilizadores u
      SET u.dinheiro_poupado = (
        SELECT COALESCE(SUM(n.ValorPoupado), 0) FROM notificacoes n WHERE n.ReferenciaID = u.ReferenciaID
      )
    `);
    if (updated && updated.affectedRows > 0) {
      console.log(' dinheiro_poupado sincronizado a partir de notificacoes (', updated.affectedRows, 'linhas)');
    }
  } catch (e) {
    console.warn(' Aviso ao sincronizar dinheiro_poupado (tabela notificacoes pode não existir):', e.message);
  }

  // Cooldown de 30 dias para alteração de senha e nome
  await addColumnIfNotExists('utilizadores', 'UltimaAlteracaoSenha', "DATETIME NULL");
  await addColumnIfNotExists('utilizadores', 'UltimaAlteracaoNome', "DATETIME NULL");
  console.log(' Colunas UltimaAlteracaoSenha e UltimaAlteracaoNome verificadas/criadas');

  // Links de cada plano: mensal e anual (checkout Stripe)
  await addColumnIfNotExists('planos', 'LinksPlanos', "VARCHAR(500) NULL");
  await addColumnIfNotExists('planos', 'LinksPlanosAnual', "VARCHAR(500) NULL");
  console.log(' Colunas LinksPlanos e LinksPlanosAnual verificadas/criadas em planos');

  // Preço anual por plano (exibir na página de planos quando toggle = Anual)
  await addColumnIfNotExists('planos', 'PrecoAnual', "DECIMAL(6,2) NULL");
  console.log(' Coluna PrecoAnual verificada/criada em planos');

  // Preencher links mensais e anuais (Stripe Checkout)
  await pool.query(`UPDATE planos SET LinksPlanos = NULL, LinksPlanosAnual = NULL WHERE Nome = 'Free'`);
  await pool.query(
    `UPDATE planos SET LinksPlanos = ?, LinksPlanosAnual = ? WHERE Nome = 'Basic'`,
    ['https://buy.stripe.com/eVqcN587y8IG3IM1dleZ201', 'https://buy.stripe.com/dRmfZh0F60ca3IMg8feZ204']
  );
  await pool.query(
    `UPDATE planos SET LinksPlanos = ?, LinksPlanosAnual = ? WHERE Nome = 'Standard'`,
    ['https://buy.stripe.com/dRm3cv73u8IG4MQ2hpeZ202', 'https://buy.stripe.com/14AaEXevWcYWdjm5tBeZ205']
  );
  await pool.query(
    `UPDATE planos SET LinksPlanos = ?, LinksPlanosAnual = ? WHERE Nome = 'Premium'`,
    ['https://buy.stripe.com/aFa14ncnO6Ay0wA7BJeZ203', 'https://buy.stripe.com/dRmbJ1evW3om9362hpeZ206']
  );
  console.log(' LinksPlanos (mensal) e LinksPlanosAnual preenchidos');

  // Preencher PrecoAnual (valor total do plano anual no Stripe; NULL para Free)
  // Ajuste os valores abaixo para coincidir com os preços anuais configurados no Stripe
  await pool.query(`UPDATE planos SET PrecoAnual = NULL WHERE Nome = 'Free'`);
  await pool.query(`UPDATE planos SET PrecoAnual = ? WHERE Nome = 'Basic'`, [49.90]);   // ex.: ~10 meses
  await pool.query(`UPDATE planos SET PrecoAnual = ? WHERE Nome = 'Standard'`, [129.90]);
  await pool.query(`UPDATE planos SET PrecoAnual = ? WHERE Nome = 'Premium'`, [153.60]);
  console.log(' PrecoAnual preenchido');

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
