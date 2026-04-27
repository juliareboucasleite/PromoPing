#!/usr/bin/env node
/**
 * Garante que a base de dados tem a estrutura correta para dinheiro poupado
 * e sincroniza utilizadores.dinheiro_poupado a partir de notificacoes.ValorPoupado.
 * Executar: node scripts/fix-dinheiro-poupado.js
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { pool } from '../backend/database/db.js';

async function main() {
  console.log(' [FIX] A verificar estrutura para dinheiro poupado...\n');

  try {
    // 1) Garantir coluna dinheiro_poupado em utilizadores
    const [colUser] = await pool.query(
      "SELECT COUNT(*)::int as c FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name)='utilizadores' AND LOWER(column_name)='dinheiro_poupado'"
    );
    if (Number(colUser[0]?.c) === 0) {
      await pool.query("ALTER TABLE utilizadores ADD COLUMN dinheiro_poupado DECIMAL(10,2) DEFAULT 0.00");
      console.log(' [FIX] Coluna utilizadores.dinheiro_poupado criada');
    } else {
      console.log(' [FIX] Coluna utilizadores.dinheiro_poupado já existe');
    }

    // 2) Garantir coluna ValorPoupado em notificacoes
    const [tables] = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND LOWER(table_name)=LOWER('notificacoes') LIMIT 1"
    );
    const notifTable = tables[0]?.table_name;
    if (notifTable) {
      const [colNotif] = await pool.query(
        "SELECT COUNT(*)::int as c FROM information_schema.columns WHERE table_schema = current_schema() AND LOWER(table_name)=LOWER(?) AND LOWER(column_name)=LOWER('ValorPoupado')",
        [notifTable]
      );
      if (Number(colNotif[0]?.c) === 0) {
        await pool.query(`ALTER TABLE "${notifTable}" ADD COLUMN "ValorPoupado" DECIMAL(10,2) DEFAULT 0.00`);
        console.log(' [FIX] Coluna notificacoes.ValorPoupado criada');
      } else {
        console.log(' [FIX] Coluna notificacoes.ValorPoupado já existe');
      }
    } else {
      console.log(' [FIX] Tabela notificacoes não encontrada (será criada pelo migrate-db ou já existe com outro nome)');
    }

    // 3) Sincronizar utilizadores.dinheiro_poupado a partir da soma de notificacoes.ValorPoupado
    try {
      const [result] = await pool.query(`
        UPDATE utilizadores u
        SET dinheiro_poupado = (
          SELECT COALESCE(SUM(n.ValorPoupado), 0)
          FROM notificacoes n
          WHERE n.ReferenciaID = u.ReferenciaID
        )
      `);
      console.log(' [FIX] Sincronização notificacoes -> utilizadores: %s linhas atualizadas', result?.affectedRows ?? 0);
    } catch (e) {
      console.warn(' [FIX] Aviso ao sincronizar (tabela notificacoes pode não existir ou ter nome diferente):', e.message);
    }

    console.log('\n [FIX] Concluído.');
  } catch (err) {
    console.error(' [FIX] Erro:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
