import { pool } from '../database/db.js';

/**
 * Serviço para gerenciar períodos de graça
 * Verifica automaticamente usuários com períodos expirados e os move para Free
 */
export class GracePeriodManager {
  
  /**
   * Verifica e atualiza usuários com períodos de graça expirados
   */
  static async checkAndUpdateExpiredGracePeriods() {
    try {
      // Verificando períodos de graça (log silencioso)
      
      // Buscar usuários com período de graça expirado
      const [expiredUsers] = await pool.query(`
        SELECT 
          s.ReferenciaID,
          s.plan_name,
          s.grace_period_end,
          c.StatusAssinatura,
          c.PlanoAtualId
        FROM stripe_subscriptions s
        JOIN configutilizador c ON s.ReferenciaID = c.ReferenciaID
        WHERE s.status = 'canceled' 
          AND s.grace_period_end IS NOT NULL 
          AND s.grace_period_end <= NOW()
      `);
      
      if (expiredUsers.length === 0) {
        // Nenhum período expirado (log silencioso)
        return { updated: 0, users: [] };
      }
      
      // Usuários com período expirado encontrados (log silencioso)
      
      const updatedUsers = [];
      
      // Atualizar cada usuário para Free
      for (const user of expiredUsers) {
        // Atualizando usuário (log silencioso)
        
        // Atualizar configutilizador para Free
        await pool.query(`
          UPDATE configutilizador 
          SET 
            PlanoAtualId = 1,  -- Free plan
            StatusAssinatura = 'Gratuita',
            DataExpiracao = NULL,
            DataCancelamento = NOW()
          WHERE ReferenciaID = ?
        `, [user.ReferenciaID]);
        
        // Atualizar stripe_subscriptions para expirado
        await pool.query(`
          UPDATE stripe_subscriptions 
          SET 
            status = 'expired',
            subscription_status = 'expired',
            updated_at = NOW()
          WHERE ReferenciaID = ? AND status = 'canceled'
        `, [user.ReferenciaID]);
        
        updatedUsers.push({
          ReferenciaID: user.ReferenciaID,
          planName: user.plan_name,
          previousStatus: user.StatusAssinatura
        });
        
        // Usuário atualizado (log silencioso)
      }
      
      // Usuários atualizados (log silencioso)
      
      return { updated: updatedUsers.length, users: updatedUsers };
      
    } catch (error) {
      console.error(' [GRACE_PERIOD] Erro ao verificar períodos expirados:', error);
      throw error;
    }
  }
  
  /**
   * Verifica se um usuário específico tem período de graça ativo
   */
  static async checkUserGracePeriod(referenciaID) {
    try {
      const [gracePeriod] = await pool.query(`
        SELECT 
          ReferenciaID,
          plan_name,
          grace_period_end,
          status
        FROM stripe_subscriptions 
        WHERE ReferenciaID = ? 
          AND status = 'canceled' 
          AND grace_period_end IS NOT NULL 
          AND grace_period_end > NOW()
      `, [referenciaID]);
      
      return gracePeriod.length > 0 ? gracePeriod[0] : null;
      
    } catch (error) {
      console.error(' [GRACE_PERIOD] Erro ao verificar período de graça do usuário:', error);
      throw error;
    }
  }
  
  /**
   * Inicia verificação automática (para ser chamada periodicamente)
   */
  static async startAutomaticCheck() {
    // Verificação automática iniciada silenciosamente
    
    // Verificar a cada 1 hora
    setInterval(async () => {
      try {
        await this.checkAndUpdateExpiredGracePeriods();
      } catch (error) {
        console.error(' [GRACE_PERIOD] Erro na verificação automática:', error);
      }
    }, 60 * 60 * 1000); // 1 hora em millisegundos
    
    // Verificação automática ativa
  }
}
