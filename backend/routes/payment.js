import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { 
  criarSessaoCheckout, 
  verificarSessaoCheckout, 
  cancelarAssinatura,
  verificarAssinatura,
  criarPortalCliente
} from "../services/payment.js";
import { pool as db } from "../database/db.js";
import stripe from "../config/stripe.js";

const router = express.Router();

/**
 * POST /api/payment/create-checkout-session
 * Criar sessão de checkout para pagamento
 */
router.post("/create-checkout-session", verifyToken, async (req, res) => {
  try {
    const { planoId } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!planoId) {
      return res.status(400).json({
        status: "error",
        error: "ID do plano é obrigatório"
      });
    }

    const resultado = await criarSessaoCheckout(userId, parseInt(planoId), userEmail);

    if (resultado.tipo === 'gratuito') {
      return res.json({
        status: "ok",
        message: "Plano gratuito ativado",
        plano: resultado.plano
      });
    }

    res.json({
      status: "ok",
      session_id: resultado.session_id,
      checkout_url: resultado.url,
      plano: resultado.plano
    });

  } catch (error) {
    console.error("Erro ao criar sessão de checkout:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

/**
 * POST /api/payment/verify-session
 * Verificar status de uma sessão de checkout e salvar assinatura
 */
router.post("/verify-session", verifyToken, async (req, res) => {
  try {
    const { session_id } = req.body;
    const userId = req.user.id;

    if (!session_id) {
      return res.status(400).json({
        status: "error",
        error: "Session ID é obrigatório"
      });
    }

    const resultado = await verificarSessaoCheckout(session_id);
    
    // Se o pagamento foi bem-sucedido, salvar a assinatura
    if (resultado.session.status === 'paid' && resultado.session.subscription_id) {
      try {
        // Buscar informações da assinatura no Stripe
        const subscription = await stripe.subscriptions.retrieve(resultado.session.subscription_id);
        const customer = await stripe.customers.retrieve(resultado.session.customer_id);
        
        // Buscar informações do plano baseado no price_id
        const priceId = subscription.items.data[0].price.id;
        const [planoData] = await db.query(`
          SELECT p.nome, p.preco, p.limite_produtos, p.verificacao_intervalo, p.permite_sms, p.relatorios
          FROM planos p
          WHERE p.id = (
            SELECT CASE 
              WHEN ? = (SELECT STRIPE_BASIC_PRICE_ID FROM (SELECT '${process.env.STRIPE_BASIC_PRICE_ID}' as STRIPE_BASIC_PRICE_ID) as env) THEN 2
              WHEN ? = (SELECT STRIPE_STANDARD_PRICE_ID FROM (SELECT '${process.env.STRIPE_STANDARD_PRICE_ID}' as STRIPE_STANDARD_PRICE_ID) as env) THEN 3
              WHEN ? = (SELECT STRIPE_PREMIUM_PRICE_ID FROM (SELECT '${process.env.STRIPE_PREMIUM_PRICE_ID}' as STRIPE_PREMIUM_PRICE_ID) as env) THEN 4
              ELSE 1
            END
          )
        `, [priceId, priceId, priceId]);
        
        const planoNome = planoData.length > 0 ? planoData[0].nome : 'Unknown';
        
        console.log(` [PAYMENT] Salvando assinatura para usuário ${userId}:`, {
          subscription_id: resultado.session.subscription_id,
          customer_id: resultado.session.customer_id,
          plan_name: planoNome
        });
        
        // Salvar na tabela stripe_subscriptions
        await db.query(`
          INSERT INTO stripe_subscriptions 
          (user_id, customer_id, subscription_id, subscription_status, price_id, plan_name, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
          ON DUPLICATE KEY UPDATE
          subscription_status = VALUES(subscription_status),
          price_id = VALUES(price_id),
          plan_name = VALUES(plan_name),
          status = VALUES(status),
          updated_at = NOW()
        `, [
          userId,
          resultado.session.customer_id,
          resultado.session.subscription_id,
          subscription.status,
          priceId,
          planoNome
        ]);
        
        // Atualizar plano do usuário na tabela configutilizador
        const planoId = planoData.length > 0 ? 
          (planoNome === 'Basic' ? 2 : planoNome === 'Standard' ? 3 : planoNome === 'Premium' ? 4 : 1) : 1;
          
        await db.query(`
          UPDATE configutilizador 
          SET PlanoAtualId = ? 
          WHERE UserId = ?
        `, [planoId, userId]);
        
        console.log(` [PAYMENT] Assinatura salva e usuário ${userId} atualizado para plano ${planoNome} (ID: ${planoId})`);
        
      } catch (saveError) {
        console.error(" [PAYMENT] Erro ao salvar assinatura:", saveError);
        // Não falhar a resposta, apenas logar o erro
      }
    }

    res.json({
      status: "ok",
      session: resultado.session
    });

  } catch (error) {
    console.error("Erro ao verificar sessão:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

/**
 * POST /api/payment/cancel-subscription
 * Cancelar assinatura com período de graça de 30 dias
 */
router.post("/cancel-subscription", verifyToken, async (req, res) => {
  try {
    const { subscription_id, cancel_type, reason } = req.body;
    const userId = req.user.id;

    if (!subscription_id) {
      return res.status(400).json({
        status: "error",
        error: "Subscription ID é obrigatório"
      });
    }

    console.log(` [CANCEL] Iniciando cancelamento para usuário ${userId}, subscription ${subscription_id}`);

    // 1. Cancelar no Stripe
    const resultado = await cancelarAssinatura(subscription_id);
    console.log(` [CANCEL] Assinatura cancelada no Stripe:`, resultado.subscription);

    // 2. Calcular período de graça (30 dias a partir de agora)
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);
    
    console.log(` [CANCEL] Período de graça até: ${gracePeriodEnd.toISOString()}`);

    // 3. Atualizar status na base de dados
    await db.query(`
      UPDATE stripe_subscriptions 
      SET status = 'canceled', 
          grace_period_end = ?, 
          cancellation_reason = ?,
          updated_at = NOW()
      WHERE subscription_id = ? AND user_id = ?
    `, [gracePeriodEnd, reason || 'canceled_by_user', subscription_id, userId]);

    // 4. Atualizar plano do usuário para Free
    await db.query(`
      UPDATE configutilizador 
      SET PlanoAtualId = 1 
      WHERE UserId = ?
    `, [userId]);

    console.log(` [CANCEL] Usuário ${userId} movido para plano Free com período de graça até ${gracePeriodEnd.toISOString()}`);

    res.json({
      status: "ok",
      message: "Assinatura cancelada com sucesso. Você manterá acesso às funcionalidades premium por 30 dias.",
      subscription: resultado.subscription,
      grace_period_end: gracePeriodEnd.toISOString(),
      message_pt: "Sua assinatura foi cancelada, mas você ainda tem acesso às funcionalidades premium até " + gracePeriodEnd.toLocaleDateString('pt-PT')
    });

  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

/**
 * GET /api/payment/subscription-status/:subscription_id
 * Verificar status de uma assinatura
 */
router.get("/subscription-status/:subscription_id", verifyToken, async (req, res) => {
  try {
    const { subscription_id } = req.params;

    const resultado = await verificarAssinatura(subscription_id);

    res.json({
      status: "ok",
      subscription: resultado.subscription
    });

  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

/**
 * POST /api/payment/create-portal-session
 * Criar sessão do portal do cliente
 */
router.post("/create-portal-session", verifyToken, async (req, res) => {
  try {
    const { customer_id } = req.body;
    
    // IMPORTANTE: Stripe SEMPRE requer HTTPS para URLs de retorno
    // Extrair o domínio da FRONTEND_URL e forçar HTTPS
    let frontendUrl = process.env.FRONTEND_URL || 'promoping.pt';
    
    // Remover qualquer esquema existente
    frontendUrl = frontendUrl.replace(/^https?:\/\//, '');
    
    // Remover barra final se existir
    frontendUrl = frontendUrl.replace(/\/$/, '');
    
    // SEMPRE usar HTTPS para URLs do Stripe (requisito do Stripe)
    const stripeReturnUrl = `https://${frontendUrl}`;
    
    const returnUrl = `${stripeReturnUrl}/dashboard/planos`;

    if (!customer_id) {
      return res.status(400).json({
        status: "error",
        error: "Customer ID é obrigatório"
      });
    }

    const resultado = await criarPortalCliente(customer_id, returnUrl);

    res.json({
      status: "ok",
      portal_url: resultado.url
    });

  } catch (error) {
    console.error("Erro ao criar portal do cliente:", error);
    res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

export default router;
