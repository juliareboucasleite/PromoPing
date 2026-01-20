// Script para popular a tabela contasconectadas com usuários que já têm discord_id
import { pool } from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function populateContasConectadas() {
  try {
    console.log('Iniciando população da tabela contasconectadas...');

    // Buscar todos os usuários que têm discord_id mas não estão em contasconectadas
    const [users] = await pool.query(
      `SELECT ReferenciaID, discord_id 
       FROM utilizadores 
       WHERE discord_id IS NOT NULL 
       AND discord_id != '' 
       AND ReferenciaID NOT IN (
         SELECT ReferenciaID 
         FROM contasconectadas 
         WHERE Tipo = 'discord'
       )`
    );

    console.log(`Encontrados ${users.length} usuários com discord_id que não estão em contasconectadas`);

    if (users.length === 0) {
      console.log(' Todos os usuários já estão sincronizados!');
      await pool.end();
      return;
    }

    // Inserir cada usuário na tabela contasconectadas
    let inserted = 0;
    for (const user of users) {
      try {
        await pool.query(
          `INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) 
           VALUES (?, 'discord', 1, NOW())`,
          [user.ReferenciaID]
        );
        inserted++;
        console.log(`Inserido: ${user.ReferenciaID} (discord_id: ${user.discord_id})`);
      } catch (error) {
        console.error(`Erro ao inserir ${user.ReferenciaID}:`, error.message);
      }
    }

    console.log(`\n Processo concluído! ${inserted} usuários inseridos na tabela contasconectadas.`);
    await pool.end();
  } catch (error) {
    console.error(' Erro ao popular contasconectadas:', error);
    await pool.end();
    process.exit(1);
  }
}

populateContasConectadas();
