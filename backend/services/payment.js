import stripe from "../config/stripe.js";
import { PLANOS_STRIPE } from "../config/stripe.js";
import { pool as db } from "../database/db.js";

const PAID_PLAN_IDS = [2, 3, 4];

function buildPriceIdToPlanMap() {
  const map = new Map();
  if (process.env.STRIPE_BASIC_PRICE_ID) map.set(process.env.STRIPE_BASIC_PRICE_ID, 2);
  if (process.env.STRIPE_STANDARD_PRICE_ID) map.set(process.env.STRIPE_STANDARD_PRICE_ID, 3);
  if (process.env.STRIPE_PREMIUM_PRICE_ID) map.set(process.env.STRIPE_PREMIUM_PRICE_ID, 4);
  return map;
}

function appendQueryParams(rawUrl, params) {
  const url = new URL(rawUrl);
  for (const [key, value] of Object.entries(params || {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function normalizeStripeRefId(referenciaID) {
  return String(referenciaID || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

export function buildClientReferenceId(referenciaID, planoId) {
  const safeRef = normalizeStripeRefId(referenciaID);
  const plan = Number.parseInt(planoId, 10);
  if (!safeRef) return "";
  if (Number.isNaN(plan) || plan <= 0) return safeRef;
  return `${safeRef}__P${plan}`;
}

export function parseClientReferenceId(clientReferenceId) {
  if (!clientReferenceId || typeof clientReferenceId !== "string") {
    return { referenciaID: null, planoId: null };
  }

  const [referenciaIDRaw] = clientReferenceId.split("__P");
  const referenciaID = referenciaIDRaw || null;
  const planMatch = clientReferenceId.match(/__P(\d+)/);
  const planNum = planMatch ? Number.parseInt(planMatch[1], 10) : null;

  return {
    referenciaID,
    planoId: Number.isNaN(planNum) ? null : planNum
  };
}

async function getPlanoById(planoId) {
  const [rows] = await db.query(
    "SELECT Id, Nome, LimiteProdutos FROM planos WHERE Id = ? LIMIT 1",
    [planoId]
  );
  return rows[0] || null;
}

async function getPlanoByName(nome) {
  const [rows] = await db.query(
    "SELECT Id, Nome, LimiteProdutos FROM planos WHERE LOWER(Nome) = LOWER(?) LIMIT 1",
    [nome]
  );
  return rows[0] || null;
}

async function resolvePlanoFromPriceOrHint(priceId, planHintId) {
  const mappedPlanId = priceId ? buildPriceIdToPlanMap().get(priceId) : null;
  if (mappedPlanId) {
    const mapped = await getPlanoById(mappedPlanId);
    if (mapped) return mapped;
  }

  if (PAID_PLAN_IDS.includes(Number(planHintId))) {
    const hinted = await getPlanoById(Number(planHintId));
    if (hinted) return hinted;
  }

  return null;
}

function normalizeLocalSubscriptionStatus(stripeStatus) {
  switch (stripeStatus) {
    case "past_due":
      return "past_due";
    case "unpaid":
      return "unpaid";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "active";
  }
}

function shouldDowngradeToFree(stripeStatus) {
  return ["canceled", "incomplete_expired", "unpaid"].includes(stripeStatus);
}

export async function salvarAssinaturaEAtualizarPlano({
  referenciaID,
  customerId,
  subscription,
  planHintId = null
}) {
  if (!referenciaID) throw new Error("referenciaID obrigatorio para salvar assinatura");
  if (!subscription?.id) throw new Error("Assinatura Stripe invalida");

  const priceId = subscription?.items?.data?.[0]?.price?.id || null;
  const localStatus = normalizeLocalSubscriptionStatus(subscription.status);
  const downgradeToFree = shouldDowngradeToFree(subscription.status);

  let plano = await resolvePlanoFromPriceOrHint(priceId, planHintId);
  if (!plano && downgradeToFree) {
    plano = await getPlanoByName("Free");
  }
  if (!plano) {
    plano = await getPlanoById(1);
  }
  if (!plano) {
    throw new Error("Plano nao encontrado na base de dados");
  }

  await db.query(
    `
      INSERT INTO stripe_subscriptions
      (ReferenciaID, customer_id, subscription_id, subscription_status, price_id, plan_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (ReferenciaID) DO UPDATE SET
        customer_id = EXCLUDED.customer_id,
        subscription_id = EXCLUDED.subscription_id,
        subscription_status = EXCLUDED.subscription_status,
        price_id = EXCLUDED.price_id,
        plan_name = EXCLUDED.plan_name,
        status = EXCLUDED.status,
        updated_at = NOW()
    `,
    [
      referenciaID,
      customerId || null,
      subscription.id,
      subscription.status,
      priceId,
      plano.Nome,
      localStatus
    ]
  );

  await db.query(
    `
      UPDATE configutilizador
      SET PlanoAtualId = ?, LimiteProdutos = ?
      WHERE ReferenciaID = ?
    `,
    [plano.Id, plano.LimiteProdutos ?? null, referenciaID]
  );

  return {
    referenciaID,
    planoId: plano.Id,
    planoNome: plano.Nome,
    priceId,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status
  };
}

export async function sincronizarAssinaturaPorReferencia(referenciaID) {
  if (!referenciaID) return { synced: false, reason: "missing_reference" };

  const [rows] = await db.query(
    `
      SELECT customer_id, subscription_id
      FROM stripe_subscriptions
      WHERE ReferenciaID = ?
      LIMIT 1
    `,
    [referenciaID]
  );

  if (rows.length === 0) {
    return { synced: false, reason: "not_found" };
  }

  const row = rows[0];
  let subscription = null;

  try {
    if (row.subscription_id) {
      subscription = await stripe.subscriptions.retrieve(row.subscription_id);
    } else if (row.customer_id) {
      const list = await stripe.subscriptions.list({
        customer: row.customer_id,
        status: "all",
        limit: 10
      });
      subscription =
        list.data.find((sub) =>
          ["active", "trialing", "past_due", "unpaid", "canceled"].includes(sub.status)
        ) || list.data[0] || null;
    }
  } catch (error) {
    return {
      synced: false,
      reason: "stripe_error",
      detail: error.message
    };
  }

  if (!subscription) {
    return { synced: false, reason: "stripe_subscription_not_found" };
  }

  const result = await salvarAssinaturaEAtualizarPlano({
    referenciaID,
    customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
    subscription,
    planHintId: Number.parseInt(subscription?.metadata?.planoId || "", 10) || null
  });

  return {
    synced: true,
    ...result
  };
}

export async function criarSessaoCheckout(referenciaID, planoId, userEmail, opts = {}) {
  try {
    const { checkoutUrlOverride } = opts || {};
    const plano = PLANOS_STRIPE[planoId];
    const clientReferenceId = buildClientReferenceId(referenciaID, planoId);

    console.log(`[PAYMENT] Criando checkout para usuario ${referenciaID}, plano ${planoId}`);
    console.log("[PAYMENT] Plano encontrado:", {
      nome: plano?.nome,
      preco: plano?.preco,
      stripe_price_id: plano?.stripe_price_id
    });

    if (!plano) {
      throw new Error("Plano invalido");
    }

    if (plano.preco === 0) {
      return {
        success: true,
        tipo: "gratuito",
        plano
      };
    }

    const linkDireto = checkoutUrlOverride || plano.stripe_checkout_url;
    if (linkDireto) {
      const trackedUrl = appendQueryParams(linkDireto, {
        client_reference_id: clientReferenceId || undefined,
        prefilled_email: userEmail || undefined
      });

      return {
        success: true,
        tipo: "checkout",
        url: trackedUrl,
        plano,
        metodo: "link_direto",
        client_reference_id: clientReferenceId
      };
    }

    if (!plano.stripe_price_id) {
      throw new Error(
        `Configuracao de pagamento nao encontrada para o plano ${plano.nome}. Configure STRIPE_${plano.nome.toUpperCase()}_CHECKOUT_URL ou STRIPE_${plano.nome.toUpperCase()}_PRICE_ID no .env`
      );
    }

    let frontendUrl = process.env.FRONTEND_URL || "promoping.pt";
    frontendUrl = frontendUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const stripeReturnUrl = `https://${frontendUrl}`;

    const successUrl = `${stripeReturnUrl}/dashboard/planos?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${stripeReturnUrl}/dashboard/planos?canceled=true`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: plano.stripe_price_id,
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: clientReferenceId || undefined,
      customer_email: userEmail,
      metadata: {
        ReferenciaID: referenciaID,
        planoId: String(planoId)
      },
      subscription_data: {
        metadata: {
          ReferenciaID: referenciaID,
          planoId: String(planoId)
        }
      }
    });

    return {
      success: true,
      tipo: "checkout",
      session_id: session.id,
      url: session.url,
      plano,
      metodo: "api",
      client_reference_id: clientReferenceId
    };
  } catch (error) {
    console.error("Erro ao criar sessao de checkout:", error);
    throw error;
  }
}

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
    console.error("Erro ao verificar sessao:", error);
    throw error;
  }
}

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
    console.error("Erro ao cancelar assinatura:", error);
    throw error;
  }
}

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
    console.error("Erro ao verificar assinatura:", error);
    throw error;
  }
}

export async function criarPortalCliente(customerId, returnUrl) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return {
      success: true,
      url: session.url
    };
  } catch (error) {
    console.error("Erro ao criar portal do cliente:", error);
    throw error;
  }
}
