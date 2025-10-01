import stripe from '../config/stripe.js';
import { PLANOS_STRIPE } from '../config/stripe.js';

/**
 * Criar sessão de checkout do Stripe
 */
export async function criarSessaoCheckout(userId, planoId, userEmail) {
  try {
    const plano = PLANOS_STRIPE[planoId];
    
    if (!plano) {
      throw new Error('Plano inválido');
    }

    // Se for plano gratuito, não precisa de checkout
    if (plano.preco === 0) {
      return {
        success: true,
        tipo: 'gratuito',
        plano: plano
      };
    }

    if (!plano.stripe_price_id) {
      throw new Error('Price ID não configurado para este plano');
    }

    // Criar sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plano.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/planos?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/planos?canceled=true`,
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

    return {
      success: true,
      tipo: 'checkout',
      session_id: session.id,
      url: session.url,
      plano: plano
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
