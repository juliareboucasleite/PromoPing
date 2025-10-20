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
      console.log('🔍 [GRACE_PERIOD] Verificando períodos de graça expirados...');
      
      // Buscar usuários com período de graça expirado
      const [expiredUsers] = await pool.query(`
        SELECT 
          s.user_id,
          s.plan_name,
          s.grace_period_end,
          c.StatusAssinatura,
          c.PlanoAtualId
        FROM stripe_subscriptions s
        JOIN configutilizador c ON s.user_id = c.UserId
        WHERE s.status = 'canceled' 
          AND s.grace_period_end IS NOT NULL 
          AND s.grace_period_end <= NOW()
      `);
      
      if (expiredUsers.length === 0) {
        console.log('✅ [GRACE_PERIOD] Nenhum período de graça expirado encontrado');
        return { updated: 0, users: [] };
      }
      
      console.log(`📊 [GRACE_PERIOD] Encontrados ${expiredUsers.length} usuários com período expirado`);
      
      const updatedUsers = [];
      
      // Atualizar cada usuário para Free
      for (const user of expiredUsers) {
        console.log(`🔧 [GRACE_PERIOD] Atualizando usuário ${user.user_id} (${user.plan_name})...`);
        
        // Atualizar configutilizador para Free
        await pool.query(`
          UPDATE configutilizador 
          SET 
            PlanoAtualId = 1,  -- Free plan
            StatusAssinatura = 'Gratuita',
            DataExpiracao = NULL,
            DataCancelamento = NOW()
          WHERE UserId = ?
        `, [user.user_id]);
        
        // Atualizar stripe_subscriptions para expirado
        await pool.query(`
          UPDATE stripe_subscriptions 
          SET 
            status = 'expired',
            subscription_status = 'expired',
            updated_at = NOW()
          WHERE user_id = ? AND status = 'canceled'
        `, [user.user_id]);
        
        updatedUsers.push({
          userId: user.user_id,
          planName: user.plan_name,
          previousStatus: user.StatusAssinatura
        });
        
        console.log(`✅ [GRACE_PERIOD] Usuário ${user.user_id} atualizado para Free`);
      }
      
      console.log(`🎉 [GRACE_PERIOD] ${updatedUsers.length} usuários atualizados para Free`);
      
      return { updated: updatedUsers.length, users: updatedUsers };
      
    } catch (error) {
      console.error('❌ [GRACE_PERIOD] Erro ao verificar períodos expirados:', error);
      throw error;
    }
  }
  
  /**
   * Verifica se um usuário específico tem período de graça ativo
   */
  static async checkUserGracePeriod(userId) {
    try {
      const [gracePeriod] = await pool.query(`
        SELECT 
          user_id,
          plan_name,
          grace_period_end,
          status
        FROM stripe_subscriptions 
        WHERE user_id = ? 
          AND status = 'canceled' 
          AND grace_period_end IS NOT NULL 
          AND grace_period_end > NOW()
      `, [userId]);
      
      return gracePeriod.length > 0 ? gracePeriod[0] : null;
      
    } catch (error) {
      console.error('❌ [GRACE_PERIOD] Erro ao verificar período de graça do usuário:', error);
      throw error;
    }
  }
  
  /**
   * Inicia verificação automática (para ser chamada periodicamente)
   */
  static async startAutomaticCheck() {
    console.log('🚀 [GRACE_PERIOD] Iniciando verificação automática de períodos de graça...');
    
    // Verificar a cada 1 hora
    setInterval(async () => {
      try {
        await this.checkAndUpdateExpiredGracePeriods();
      } catch (error) {
        console.error('❌ [GRACE_PERIOD] Erro na verificação automática:', error);
      }
    }, 60 * 60 * 1000); // 1 hora em millisegundos
    
    console.log('✅ [GRACE_PERIOD] Verificação automática iniciada (a cada 1 hora)');
  }
}
