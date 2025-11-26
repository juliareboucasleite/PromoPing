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
            // Primeiro, tentar com DataDesativacao, se não existir usar Data_Registo como fallback
            let expiredAccounts = [];

            try {
                // Tentar buscar com DataDesativacao
                const [accountsWithDate] = await pool.query(`
          SELECT 
            Id,
            Nome,
            Email,
            DataDesativacao,
            Data_Registo
          FROM Utilizadores 
          WHERE Ativo = 0 
            AND DataDesativacao IS NOT NULL 
            AND DataDesativacao <= DATE_SUB(NOW(), INTERVAL 20 DAY)
        `);
                expiredAccounts = accountsWithDate;
            } catch (error) {
                // Se a coluna não existir, usar Data_Registo como fallback
                console.log('[DEACTIVATED_ACCOUNTS] Coluna DataDesativacao não encontrada, usando Data_Registo');
                const [accountsFallback] = await pool.query(`
          SELECT 
            Id,
            Nome,
            Email,
            NULL as DataDesativacao,
            Data_Registo
          FROM Utilizadores 
          WHERE Ativo = 0 
            AND Data_Registo <= DATE_SUB(NOW(), INTERVAL 20 DAY)
        `);
                expiredAccounts = accountsFallback;
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
                    const userId = account.Id;

                    // Iniciar transação
                    const connection = await pool.getConnection();
                    await connection.beginTransaction();

                    try {
                        // Deletar todos os dados relacionados (mesma lógica da rota de exclusão)
                        await connection.query("DELETE FROM Produtos WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM configutilizador WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM preferenciasnotificacao WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM contasconectadas WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM stripe_subscriptions WHERE user_id = ?", [userId]);
                        await connection.query("DELETE FROM notificacoes WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM supportmessages WHERE userId = ?", [userId]);
                        await connection.query("DELETE FROM recuperar_senha WHERE UserId = ?", [userId]);
                        await connection.query("DELETE FROM Utilizadores WHERE Id = ?", [userId]);

                        await connection.commit();
                        connection.release();

                        deletedAccounts.push({
                            id: userId,
                            email: account.Email
                        });
                        // Log removido - apenas resultado final será logado
                    } catch (error) {
                        await connection.rollback();
                        connection.release();
                        console.error(`[DEACTIVATED_ACCOUNTS] Erro ao deletar conta ${userId}:`, error);
                    }
                } catch (error) {
                    console.error(`[DEACTIVATED_ACCOUNTS] Erro ao processar conta ${account.Id}:`, error);
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