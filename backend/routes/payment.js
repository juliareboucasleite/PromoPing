import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  criarSessaoCheckout,
  verificarSessaoCheckout,
  cancelarAssinatura,
  verificarAssinatura,
  criarPortalCliente,
  salvarAssinaturaEAtualizarPlano,
  sincronizarAssinaturaPorReferencia,
  parseClientReferenceId
} from "../services/payment.js";
import { pool as db } from "../database/db.js";
import stripe from "../config/stripe.js";

const router = express.Router();

async function resolveReferenciaIdFromEmail(email) {
  if (!email) return null;
  const [rows] = await db.query(
    "SELECT ReferenciaID FROM Utilizadores WHERE LOWER(Email) = LOWER(?) LIMIT 1",
    [email]
  );
  return rows[0]?.ReferenciaID || null;
}

async function resolveReferenciaIdFromSubscription(subscription) {
  const metaRef = subscription?.metadata?.ReferenciaID || subscription?.metadata?.referenciaid || null;
  if (metaRef) return metaRef;

  if (subscription?.id) {
    const [bySub] = await db.query(
      "SELECT ReferenciaID FROM stripe_subscriptions WHERE subscription_id = ? LIMIT 1",
      [subscription.id]
    );
    if (bySub.length > 0) return bySub[0].ReferenciaID;
  }

  const customerId =
    typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id || null;
  if (customerId) {
    const [byCustomer] = await db.query(
      "SELECT ReferenciaID FROM stripe_subscriptions WHERE customer_id = ? LIMIT 1",
      [customerId]
    );
    if (byCustomer.length > 0) return byCustomer[0].ReferenciaID;
  }

  return null;
}

async function processCheckoutSessionCompleted(session) {
  if (session?.mode && session.mode !== "subscription") {
    return { ignored: true, reason: "non_subscription_session" };
  }

  const subscriptionId =
    typeof session?.subscription === "string" ? session.subscription : session?.subscription?.id || null;
  const customerId = typeof session?.customer === "string" ? session.customer : session?.customer?.id || null;

  if (!subscriptionId) return { ignored: true, reason: "missing_subscription_id" };

  const parsedClientRef = parseClientReferenceId(session?.client_reference_id || "");
  const metadataRef = session?.metadata?.ReferenciaID || session?.metadata?.referenciaid || null;
  const emailRef = await resolveReferenciaIdFromEmail(session?.customer_details?.email || session?.customer_email);
  const referenciaID = metadataRef || parsedClientRef.referenciaID || emailRef;

  if (!referenciaID) {
    return { ignored: true, reason: "missing_reference" };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planHintId =
    parsedClientRef.planoId ||
    Number.parseInt(session?.metadata?.planoId || "", 10) ||
    Number.parseInt(subscription?.metadata?.planoId || "", 10) ||
    null;

  return await salvarAssinaturaEAtualizarPlano({
    referenciaID,
    customerId,
    subscription,
    planHintId
  });
}

async function processSubscriptionEvent(subscription) {
  const referenciaID = await resolveReferenciaIdFromSubscription(subscription);
  if (!referenciaID) {
    return { ignored: true, reason: "missing_reference" };
  }

  const customerId =
    typeof subscription?.customer === "string" ? subscription.customer : subscription?.customer?.id || null;
  const planHintId = Number.parseInt(subscription?.metadata?.planoId || "", 10) || null;

  return await salvarAssinaturaEAtualizarPlano({
    referenciaID,
    customerId,
    subscription,
    planHintId
  });
}

export async function stripeWebhookHandler(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({
      status: "error",
      error: "STRIPE_WEBHOOK_SECRET nao configurado"
    });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({
      status: "error",
      error: "Stripe signature ausente"
    });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(400).json({
      status: "error",
      error: "Payload invalido para validacao de assinatura Stripe"
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error) {
    console.error("[PAYMENT WEBHOOK] Assinatura invalida:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await processCheckoutSessionCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await processSubscriptionEvent(event.data.object);
        break;
      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[PAYMENT WEBHOOK] Erro ao processar evento:", event.type, error);
    return res.status(500).json({
      status: "error",
      error: "Erro interno ao processar webhook"
    });
  }
}

router.post("/create-checkout-session", verifyToken, async (req, res) => {
  try {
    const { planoId, anual } = req.body;
    const referenciaID = req.user.ReferenciaID;
    const userEmail = req.user.email;

    if (!planoId) {
      return res.status(400).json({
        status: "error",
        error: "ID do plano e obrigatorio"
      });
    }

    let checkoutUrlOverride = null;
    if (Number.parseInt(planoId, 10) > 1) {
      const [rows] = await db.query("SELECT LinksPlanos, LinksPlanosAnual FROM planos WHERE Id = ?", [
        Number.parseInt(planoId, 10)
      ]);
      if (rows.length > 0) {
        const current = rows[0];
        const linkMensal = current.LinksPlanos ?? null;
        const linkAnual = current.LinksPlanosAnual ?? null;
        checkoutUrlOverride = anual ? linkAnual || linkMensal : linkMensal || linkAnual;
      }
    }

    const resultado = await criarSessaoCheckout(referenciaID, Number.parseInt(planoId, 10), userEmail, {
      checkoutUrlOverride
    });

    if (resultado.tipo === "gratuito") {
      return res.json({
        status: "ok",
        message: "Plano gratuito ativado",
        plano: resultado.plano
      });
    }

    const responseData = {
      status: "ok",
      checkout_url: resultado.url,
      url: resultado.url,
      plano: resultado.plano
    };
    if (resultado.session_id) {
      responseData.session_id = resultado.session_id;
    }
    return res.json(responseData);
  } catch (error) {
    console.error("Erro ao criar sessao de checkout:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post("/verify-session", verifyToken, async (req, res) => {
  try {
    const { session_id } = req.body;
    const referenciaID = req.user.ReferenciaID;

    if (!session_id) {
      return res.status(400).json({
        status: "error",
        error: "Session ID e obrigatorio"
      });
    }

    const resultado = await verificarSessaoCheckout(session_id);

    if (resultado.session.status === "paid" && resultado.session.subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(resultado.session.subscription_id);
        await salvarAssinaturaEAtualizarPlano({
          referenciaID,
          customerId: resultado.session.customer_id,
          subscription,
          planHintId: Number.parseInt(resultado.session?.metadata?.planoId || "", 10) || null
        });
      } catch (saveError) {
        console.error("[PAYMENT] Erro ao salvar assinatura via verify-session:", saveError);
      }
    }

    return res.json({
      status: "ok",
      session: resultado.session
    });
  } catch (error) {
    console.error("Erro ao verificar sessao:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post("/sync-subscription", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const resultado = await sincronizarAssinaturaPorReferencia(referenciaID);

    return res.json({
      status: "ok",
      ...resultado
    });
  } catch (error) {
    console.error("[PAYMENT] Erro ao sincronizar assinatura:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post("/cancel-subscription", verifyToken, async (req, res) => {
  try {
    const { subscription_id: incomingSubscriptionId, reason } = req.body || {};
    const referenciaID = req.user.ReferenciaID;
    let subscriptionId = incomingSubscriptionId || null;

    if (!subscriptionId) {
      const [rows] = await db.query(
        `
          SELECT subscription_id
          FROM stripe_subscriptions
          WHERE ReferenciaID = ?
            AND subscription_status IN ('active', 'trialing', 'past_due', 'unpaid')
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        [referenciaID]
      );
      subscriptionId = rows[0]?.subscription_id || null;
    }

    if (!subscriptionId) {
      return res.status(404).json({
        status: "error",
        error: "Nenhuma assinatura ativa encontrada para cancelamento"
      });
    }

    const resultado = await cancelarAssinatura(subscriptionId);

    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    await db.query(
      `
      UPDATE stripe_subscriptions
      SET status = 'canceled',
          subscription_status = 'canceled',
          grace_period_end = ?,
          cancellation_reason = ?,
          updated_at = NOW()
      WHERE subscription_id = ? AND ReferenciaID = ?
    `,
      [gracePeriodEnd, reason || "canceled_by_user", subscriptionId, referenciaID]
    );

    await db.query(
      `
      UPDATE configutilizador
      SET PlanoAtualId = 1
      WHERE ReferenciaID = ?
    `,
      [referenciaID]
    );

    return res.json({
      status: "ok",
      message:
        "Assinatura cancelada com sucesso. Voce mantera acesso as funcionalidades premium por 30 dias.",
      subscription: resultado.subscription,
      grace_period_end: gracePeriodEnd.toISOString(),
      message_pt:
        "Sua assinatura foi cancelada, mas voce ainda tem acesso as funcionalidades premium ate " +
        gracePeriodEnd.toLocaleDateString("pt-PT")
    });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.get("/subscription-status/:subscription_id", verifyToken, async (req, res) => {
  try {
    const { subscription_id } = req.params;
    const resultado = await verificarAssinatura(subscription_id);

    return res.json({
      status: "ok",
      subscription: resultado.subscription
    });
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

router.post("/create-portal-session", verifyToken, async (req, res) => {
  try {
    const { customer_id } = req.body;

    let frontendUrl = process.env.FRONTEND_URL || "promoping.pt";
    frontendUrl = frontendUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const stripeReturnUrl = `https://${frontendUrl}`;
    const returnUrl = `${stripeReturnUrl}/dashboard/planos`;

    if (!customer_id) {
      return res.status(400).json({
        status: "error",
        error: "Customer ID e obrigatorio"
      });
    }

    const resultado = await criarPortalCliente(customer_id, returnUrl);
    return res.json({
      status: "ok",
      portal_url: resultado.url
    });
  } catch (error) {
    console.error("Erro ao criar portal do cliente:", error);
    return res.status(500).json({
      status: "error",
      error: error.message
    });
  }
});

export default router;
