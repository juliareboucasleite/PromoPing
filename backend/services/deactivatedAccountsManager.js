import {
    pool
} from '../database/db.js';

/**
 * Serviço para gerenciar contas desativadas
 * Verifica automaticamente contas desativadas há mais de 20 dias e as deleta
 */
export class DeactivatedAccountsManager {

    /**
     * Verifica e deleta contas desativadas há mais de 20 dias
     */
    static async checkAndDeleteExpiredAccounts() {
        try {
            console.log(`[DEACTIVATED_ACCOUNTS] Verificando contas desativadas expiradas...`);

            // Buscar contas desativadas há mais de 20 dias
            // Primeiro, tentar com DataDesativacao, se não existir usar DataRegisto como fallback
            let expiredAccounts = [];

            try {
                // Tentar buscar com DataDesativacao
                const [accountsWithDate] = await pool.query(`
          SELECT 
            ReferenciaID,
            Nome,
            Email,
            DataDesativacao,
            DataRegisto
          FROM utilizadores 
          WHERE Ativo = 0 
            AND DataDesativacao IS NOT NULL 
            AND DataDesativacao <= NOW() - INTERVAL '20 days'
        `);
                expiredAccounts = accountsWithDate;
            } catch (error) {
                // Se a coluna não existir, não há contas para deletar (sem data de desativação)
                console.log('[DEACTIVATED_ACCOUNTS] Coluna DataDesativacao não encontrada, nenhuma conta para deletar');
                expiredAccounts = [];
            }

            if (expiredAccounts.length === 0) {
                // Log removido - nenhuma ação necessária
                return {
                    deleted: 0,
                    accounts: []
                };
            }

            // Log removido para reduzir verbosidade - apenas resultado final será logado

            const deletedAccounts = [];

            // Deletar cada conta expirada
            for (const account of expiredAccounts) {
                try {
                    const referenciaID = account.ReferenciaID;

                    // Iniciar transação
                    const connection = await pool.getConnection();
                    await connection.beginTransaction();

                    try {
                        // Deletar todos os dados relacionados (mesma lógica da rota de exclusão)
                        await connection.query("DELETE FROM Produtos WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM configutilizador WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM preferenciasnotificacao WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM contasconectadas WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM stripe_subscriptions WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM notificacoes WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM supportmessages WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM recuperar_senha WHERE ReferenciaID = ?", [referenciaID]);
                        await connection.query("DELETE FROM utilizadores WHERE ReferenciaID = ?", [referenciaID]);

                        await connection.commit();
                        connection.release();

                        deletedAccounts.push({
                            ReferenciaID: referenciaID,
                            email: account.Email
                        });
                        // Log removido - apenas resultado final será logado
                    } catch (error) {
                        await connection.rollback();
                        connection.release();
                        console.error(`[DEACTIVATED_ACCOUNTS] Erro ao deletar conta ${referenciaID}:`, error);
                    }
                } catch (error) {
                    console.error(`[DEACTIVATED_ACCOUNTS] Erro ao processar conta ${account.ReferenciaID}:`, error);
                }
            }

            // Log apenas se houver contas deletadas
            if (deletedAccounts.length > 0) {
                console.log(`[DEACTIVATED_ACCOUNTS] ${deletedAccounts.length} conta(s) deletada(s) automaticamente`);
            }
            return {
                deleted: deletedAccounts.length,
                accounts: deletedAccounts
            };
        } catch (error) {
            console.error('[DEACTIVATED_ACCOUNTS] Erro na verificação de contas expiradas:', error);
            throw error;
        }
    }

    /**
     * Inicia verificação automática (para ser chamada no servidor)
     */
    static async startAutomaticCheck() {
        // Log removido para reduzir verbosidade - apenas erros serão logados

        // Verificar a cada 24 horas
        setInterval(async () => {
            try {
                await this.checkAndDeleteExpiredAccounts();
            } catch (error) {
                console.error('[DEACTIVATED_ACCOUNTS] Erro na verificação automática:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 horas em millisegundos

        // Executar imediatamente na inicialização (silenciosamente)
        try {
            await this.checkAndDeleteExpiredAccounts();
        } catch (error) {
            console.error('[DEACTIVATED_ACCOUNTS] Erro na verificação inicial:', error);
        }
    }
}