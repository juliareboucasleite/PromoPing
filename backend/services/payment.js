import stripe from '../config/stripe.js';
import { PLANOS_STRIPE } from '../config/stripe.js';

/**
 * Criar sessão de checkout do Stripe
 */
export async function criarSessaoCheckout(userId, planoId, userEmail) {
  try {
    const plano = PLANOS_STRIPE[planoId];
    
    console.log(` [PAYMENT] Criando checkout para usuário ${userId}, plano ${planoId}`);
    console.log(` [PAYMENT] Plano encontrado:`, {
      nome: plano?.nome,
      preco: plano?.preco,
      stripe_price_id: plano?.stripe_price_id
    });
    
    // Verificar compatibilidade entre chave Stripe e price IDs
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
    const isTestMode = stripeSecretKey.startsWith('sk_test_');
    const isLiveMode = stripeSecretKey.startsWith('sk_live_');
    
    if (plano?.stripe_price_id) {
      const priceId = plano.stripe_price_id;
      // Price IDs de teste geralmente começam com price_ e não têm padrão específico
      // Mas podemos verificar se há incompatibilidade conhecida
      console.log(` [PAYMENT] Modo Stripe: ${isTestMode ? 'TEST' : isLiveMode ? 'LIVE' : 'DESCONHECIDO'}`);
      console.log(` [PAYMENT] Price ID: ${priceId}`);
      
      if (isTestMode && priceId) {
        console.warn(` [PAYMENT] ATENÇÃO: Usando chave de TEST com price ID. Certifique-se de que o price ID é de TEST mode.`);
      }
      if (isLiveMode && priceId) {
        console.log(` [PAYMENT] Usando chave de LIVE com price ID de produção.`);
      }
    }
    
    // Log detalhado para debug
    console.log(` [PAYMENT] DEBUG - Variáveis de ambiente:`, {
      STRIPE_SECRET_KEY: stripeSecretKey ? `${stripeSecretKey.substring(0, 20)}...` : 'não definido',
      STRIPE_BASIC_PRICE_ID: process.env.STRIPE_BASIC_PRICE_ID,
      STRIPE_STANDARD_PRICE_ID: process.env.STRIPE_STANDARD_PRICE_ID,
      STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID
    });
    
    // Log específico para o plano Standard
    if (planoId === 3) {
      console.log(` [PAYMENT] DEBUG - Plano Standard detectado!`);
      console.log(` [PAYMENT] DEBUG - STRIPE_STANDARD_PRICE_ID: ${process.env.STRIPE_STANDARD_PRICE_ID}`);
      console.log(` [PAYMENT] DEBUG - Price ID que será usado: ${plano.stripe_price_id}`);
    }
    
    if (!plano) {
      throw new Error('Plano inválido');
    }

    // Se for plano gratuito, não precisa de checkout
    if (plano.preco === 0) {
      console.log(` [PAYMENT] Plano gratuito detectado - ativação direta`);
      return {
        success: true,
        tipo: 'gratuito',
        plano: plano
      };
    }

    // Verificar se há link direto do Stripe (preferencial)
    if (plano.stripe_checkout_url) {
      console.log(` [PAYMENT] Usando link direto do Stripe para plano ${plano.nome}`);
      console.log(` [PAYMENT] URL: ${plano.stripe_checkout_url}`);
      
      return {
        success: true,
        tipo: 'checkout',
        url: plano.stripe_checkout_url,
        plano: plano,
        metodo: 'link_direto'
      };
    }

    // Fallback: criar sessão via API se não houver link direto
    if (!plano.stripe_price_id) {
      console.error(` [PAYMENT] Nem link direto nem price ID configurado para plano ${plano.nome}`);
      throw new Error(`Configuração de pagamento não encontrada para o plano ${plano.nome}. Configure STRIPE_${plano.nome.toUpperCase()}_CHECKOUT_URL ou STRIPE_${plano.nome.toUpperCase()}_PRICE_ID no .env`);
    }

    console.log(` [PAYMENT] Usando API do Stripe com price_id: ${plano.stripe_price_id} para plano ${plano.nome}`);
    console.log(` [PAYMENT] ATENÇÃO: Se este price_id não for válido, o Stripe pode redirecionar para outro plano!`);

    // Criar sessão de checkout via API
    console.log(` [PAYMENT] Criando sessão Stripe com price_id: ${plano.stripe_price_id}`);
    
    // IMPORTANTE: Stripe SEMPRE requer HTTPS para URLs de retorno, mesmo em desenvolvimento
    // Extrair o domínio da FRONTEND_URL e forçar HTTPS
    let frontendUrl = process.env.FRONTEND_URL || 'promoping.pt';
    
    // Remover qualquer esquema existente
    frontendUrl = frontendUrl.replace(/^https?:\/\//, '');
    
    // Remover barra final se existir
    frontendUrl = frontendUrl.replace(/\/$/, '');
    
    // SEMPRE usar HTTPS para URLs do Stripe (requisito do Stripe)
    const stripeReturnUrl = `https://${frontendUrl}`;
    
    const successUrl = `${stripeReturnUrl}/dashboard/planos?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${stripeReturnUrl}/dashboard/planos?canceled=true`;
    
    console.log(` [PAYMENT] URLs de retorno do Stripe (sempre HTTPS):`, { 
      frontendUrlOriginal: process.env.FRONTEND_URL || 'não definido',
      frontendUrlProcessado: frontendUrl,
      stripeReturnUrl,
      successUrl, 
      cancelUrl 
    });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plano.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        userId: userId.toString(),
        planoId: planoId.toString()
      },
      subscription_data: {
        metadata: {
          userId: userId.toString(),
          planoId: planoId.toString()
        }
      }
    });

    console.log(` [PAYMENT] Sessão criada com sucesso:`, {
      session_id: session.id,
      url: session.url,
      plano: plano.nome
    });

    return {
      success: true,
      tipo: 'checkout',
      session_id: session.id,
      url: session.url,
      plano: plano,
      metodo: 'api'
    };

  } catch (error) {
    console.error('Erro ao criar sessão de checkout:', error);
    throw error;
  }
}

/**
 * Verificar status de uma sessão de checkout
 */
export async function verificarSessaoCheckout(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    return {
      success: true,
      session: {
        id: session.id,
        status: session.payment_status,
        subscription_id: session.subscription,
        customer_id: session.customer,
        metadata: session.metadata
      }
    };
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    throw error;
  }
}

/**
 * Cancelar assinatura
 */
export async function cancelarAssinatura(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    
    return {
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        canceled_at: subscription.canceled_at
      }
    };
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw error;
  }
}

/**
 * Verificar status de uma assinatura
 */
export async function verificarAssinatura(subscriptionId) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return {
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end
      }
    };
  } catch (error) {
    console.error('Erro ao verificar assinatura:', error);
    throw error;
  }
}

/**
 * Criar portal do cliente para gerenciar assinatura
 */
export async function criarPortalCliente(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return {
      success: true,
      url: session.url
    };
  } catch (error) {
    console.error('Erro ao criar portal do cliente:', error);
    throw error;
  }
}
