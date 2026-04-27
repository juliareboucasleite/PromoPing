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
    const { planoId, anual } = req.body;
    const referenciaID = req.user.ReferenciaID;
    const userEmail = req.user.email;

    if (!planoId) {
      return res.status(400).json({
        status: "error",
        error: "ID do plano é obrigatório"
      });
    }

    let checkoutUrlOverride = null;
    if (parseInt(planoId) > 1) {
      const [rows] = await db.query(
        "SELECT LinksPlanos, LinksPlanosAnual FROM planos WHERE Id = ?",
        [parseInt(planoId)]
      );
      if (rows.length > 0) {
        const r = rows[0];
        const linkMensal = r.LinksPlanos ?? null;
        const linkAnual = r.LinksPlanosAnual ?? null;
        checkoutUrlOverride = anual ? (linkAnual || linkMensal) : (linkMensal || linkAnual);
      }
    }

    const resultado = await criarSessaoCheckout(referenciaID, parseInt(planoId), userEmail, { checkoutUrlOverride });

    console.log(`[PAYMENT ROUTE] Resultado recebido:`, {
      tipo: resultado.tipo,
      url: resultado.url,
      session_id: resultado.session_id,
      metodo: resultado.metodo
    });

    if (resultado.tipo === 'gratuito') {
      return res.json({
        status: "ok",
        message: "Plano gratuito ativado",
        plano: resultado.plano
      });
    }

    // Garantir que sempre retornamos checkout_url
    const responseData = {
      status: "ok",
      checkout_url: resultado.url,
      url: resultado.url, // Duplicado para garantir compatibilidade
      plano: resultado.plano
    };

    // Adicionar session_id apenas se existir (não existe para links diretos)
    if (resultado.session_id) {
      responseData.session_id = resultado.session_id;
    }

    console.log(`[PAYMENT ROUTE] Enviando resposta:`, responseData);

    res.json(responseData);

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
    const referenciaID = req.user.ReferenciaID;

    if (!session_id) {
      return res.status(400).json({
        status: "error",
        error: "Session ID é obrigatório"
      });
    }

    const resultado = await verificarSessaoCheckout(session_id);
    
    // Se o pagamento foi bem-sucedido, salvar a assinatura
    // ATENÇÃO: Essa parte aqui salva a assinatura no banco DEPOIS do pagamento
    // Se tu fuder isso, o usuário paga mas não recebe o plano
    // E aí vai ter que lidar com cliente puto reclamando
    // NÃO MEXA NESSA MERDA SEM ENTENDER O FLUXO COMPLETO
    if (resultado.session.status === 'paid' && resultado.session.subscription_id) {
      try {
        // Buscar informações da assinatura no Stripe
        const subscription = await stripe.subscriptions.retrieve(resultado.session.subscription_id);
        const customer = await stripe.customers.retrieve(resultado.session.customer_id);
        
        // Buscar informações do plano baseado no price_id
        // ESSE PRICE_ID É O QUE DEFINE QUAL PLANO O CARA COMPROU
        // Se tu pegar errado, vai dar o plano errado pro usuário
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
        
        console.log(` [PAYMENT] Salvando assinatura para usuário ${referenciaID}:`, {
          subscription_id: resultado.session.subscription_id,
          customer_id: resultado.session.customer_id,
          plan_name: planoNome
        });
        
        // Salvar na tabela stripe_subscriptions
        await db.query(`
          INSERT INTO stripe_subscriptions
          (ReferenciaID, customer_id, subscription_id, subscription_status, price_id, plan_name, status)
          VALUES (?, ?, ?, ?, ?, ?, 'active')
          ON CONFLICT (ReferenciaID) DO UPDATE SET
            subscription_status = EXCLUDED.subscription_status,
            price_id = EXCLUDED.price_id,
            plan_name = EXCLUDED.plan_name,
            status = EXCLUDED.status,
            updated_at = NOW()
        `, [
          referenciaID,
          resultado.session.customer_id,
          resultado.session.subscription_id,
          subscription.status,
          priceId,
          planoNome
        ]);
        

        // Atualizar plano do usuário na tabela configutilizador
        // ESSA PARTE AQUI É CRÍTICA: atualiza o plano do usuário DEPOIS do pagamento
        // Se tu fuder essa query, o usuário paga mas continua no plano Free
        // E aí ele vai reclamar que pagou e não recebeu o plano
        // Os IDs dos planos são: 1=Free, 2=Basic, 3=Standard, 4=Premium
        // NÃO MUDE ESSES NÚMEROS SEM SABER O QUE TÁ FAZENDO
        const planoId = planoData.length > 0 ? 
          (planoNome === 'Basic' ? 2 : planoNome === 'Standard' ? 3 : planoNome === 'Premium' ? 4 : 1) : 1;
          
        await db.query(`
          UPDATE configutilizador 
          SET PlanoAtualId = ? 
          WHERE ReferenciaID = ?
        `, [planoId, referenciaID]);

        console.log(` [PAYMENT] Assinatura salva e usuário ${referenciaID} atualizado para plano ${planoNome} (ID: ${planoId})`);
        
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
    const referenciaID = req.user.ReferenciaID;

    if (!subscription_id) {
      return res.status(400).json({
        status: "error",
        error: "Subscription ID é obrigatório"
      });
    }

    console.log(` [CANCEL] Iniciando cancelamento para usuário ${referenciaID}, subscription ${subscription_id}`);

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
      WHERE subscription_id = ? AND ReferenciaID = ?
    `, [gracePeriodEnd, reason || 'canceled_by_user', subscription_id, referenciaID]);

    // 4. Atualizar plano do usuário para Free
    await db.query(`
      UPDATE configutilizador 
      SET PlanoAtualId = 1 
      WHERE ReferenciaID = ?
    `, [referenciaID]);

    console.log(` [CANCEL] Usuário ${referenciaID} movido para plano Free com período de graça até ${gracePeriodEnd.toISOString()}`);

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
