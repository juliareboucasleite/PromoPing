#!/usr/bin/env node
/**
 * Cria a tabela qr_tokens na base de dados (login por QR).
 * Pode ser executado antes de iniciar o servidor: node scripts/ensure-qr-tokens-table.js
 */

import { initializeAllTables } from '../backend/database/tableManager.js';

async function main() {
  console.log(' A verificar/criar tabelas (incluindo qr_tokens)...');
  const results = await initializeAllTables();
  const created = results.created || [];
  const existing = results.existing || [];
  const qrCreated = created.some((e) => e.table === 'qr_tokens');
  const qrExisting = existing.some((e) => e.table === 'qr_tokens');
  if (qrCreated) {
    console.log(' Tabela qr_tokens criada.');
  } else if (qrExisting) {
    console.log(' Tabela qr_tokens já existe.');
  } else {
    console.log(' Tabelas inicializadas.');
  }
  if ((results.errors || []).length > 0) {
    console.warn(' Avisos:', results.errors.map((e) => e.table + ': ' + e.error).join('; '));
  }
  console.log(' Concluído.');
  process.exit(0);
}

main().catch((err) => {
  console.error(' Erro:', err.message);
  process.exit(1);
});
