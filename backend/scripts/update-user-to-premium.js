/**
 * Script para atualizar um usuário para o plano Premium
 * Uso: node backend/scripts/update-user-to-premium.js REF-557643948
 */

import { pool } from '../database/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function updateUserToPremium(referenciaID) {
    try {
        console.log(`\n[UPDATE] Atualizando usuário ${referenciaID} para Premium...\n`);

        // Verificar se o usuário existe
        const [users] = await pool.query(
            'SELECT ReferenciaID, Nome, Email FROM utilizadores WHERE ReferenciaID = ?',
            [referenciaID]
        );

        if (users.length === 0) {
            console.error(`[ERRO] Usuário com ReferenciaID ${referenciaID} não encontrado!`);
            process.exit(1);
        }

        console.log(`[INFO] Usuário encontrado: ${users[0].Nome} (${users[0].Email})`);

        // Buscar ID do plano Premium
        const [premiumPlan] = await pool.query(
            "SELECT Id, Nome FROM planos WHERE Nome = 'Premium' LIMIT 1"
        );

        if (premiumPlan.length === 0) {
            console.error('[ERRO] Plano Premium não encontrado na base de dados!');
            process.exit(1);
        }

        const premiumPlanId = premiumPlan[0].Id;
        console.log(`[INFO] ID do plano Premium: ${premiumPlanId}`);

        // Verificar se existe configuração do usuário
        const [config] = await pool.query(
            'SELECT Id FROM configutilizador WHERE ReferenciaID = ?',
            [referenciaID]
        );

        if (config.length === 0) {
            // Criar configuração se não existir
            console.log('[INFO] Criando configuração do usuário...');
            await pool.query(
                `INSERT INTO configutilizador 
                 (ReferenciaID, PlanoAtualId, PlanoAtivoId, StatusAssinatura, LimiteProdutos, HistoricoDias) 
                 VALUES (?, ?, ?, 'Ativa', 9999, NULL)`,
                [referenciaID, premiumPlanId, premiumPlanId]
            );
            console.log('[SUCESSO] Configuração criada com sucesso!');
        } else {
            // Atualizar configuração existente
            console.log('[INFO] Atualizando configuração do usuário...');
            await pool.query(
                `UPDATE configutilizador 
                 SET PlanoAtualId = ?, 
                     PlanoAtivoId = ?, 
                     StatusAssinatura = 'Ativa',
                     LimiteProdutos = 9999,
                     HistoricoDias = NULL,
                     DataCancelamento = NULL,
                     DataExpiracao = NULL
                 WHERE ReferenciaID = ?`,
                [premiumPlanId, premiumPlanId, referenciaID]
            );
            console.log('[SUCESSO] Configuração atualizada com sucesso!');
        }

        // Verificar resultado
        const [updatedConfig] = await pool.query(
            `SELECT c.*, p.Nome as PlanoNome 
             FROM configutilizador c 
             JOIN planos p ON c.PlanoAtualId = p.Id 
             WHERE c.ReferenciaID = ?`,
            [referenciaID]
        );

        if (updatedConfig.length > 0) {
            console.log('\n[RESULTADO] Configuração atualizada:');
            console.log(`  - ReferenciaID: ${updatedConfig[0].ReferenciaID}`);
            console.log(`  - Plano: ${updatedConfig[0].PlanoNome}`);
            console.log(`  - Status: ${updatedConfig[0].StatusAssinatura}`);
            console.log(`  - Limite de Produtos: ${updatedConfig[0].LimiteProdutos}`);
            console.log(`  - Histórico Dias: ${updatedConfig[0].HistoricoDias || 'Ilimitado'}`);
        }

        console.log('\n[SUCESSO] Usuário atualizado para Premium com sucesso!\n');
        process.exit(0);

    } catch (error) {
        console.error('[ERRO] Erro ao atualizar usuário:', error);
        process.exit(1);
    }
}

// Obter ReferenciaID dos argumentos da linha de comando
const referenciaID = process.argv[2];

if (!referenciaID) {
    console.error('[ERRO] Por favor, forneça o ReferenciaID do usuário!');
    console.error('Uso: node backend/scripts/update-user-to-premium.js REF-XXXXX');
    process.exit(1);
}

// Validar formato do ReferenciaID
if (!referenciaID.startsWith('REF-') || referenciaID.length !== 13) {
    console.error('[ERRO] ReferenciaID inválido! Deve estar no formato REF-XXXXXXXXX');
    process.exit(1);
}

// Executar atualização
updateUserToPremium(referenciaID).finally(() => {
    pool.end();
});
