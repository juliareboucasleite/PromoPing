import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { 
  criarSessaoCheckout, 
  verificarSessaoCheckout, 
  cancelarAssinatura,
  verificarAssinatura,
  criarPortalCliente
} from "../services/payment.js";

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
 * Verificar status de uma sessão de checkout
 */
router.post("/verify-session", verifyToken, async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        status: "error",
        error: "Session ID é obrigatório"
      });
    }

    const resultado = await verificarSessaoCheckout(session_id);

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
 * Cancelar assinatura
 */
router.post("/cancel-subscription", verifyToken, async (req, res) => {
  try {
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({
        status: "error",
        error: "Subscription ID é obrigatório"
      });
    }

    const resultado = await cancelarAssinatura(subscription_id);

    res.json({
      status: "ok",
      message: "Assinatura cancelada com sucesso",
      subscription: resultado.subscription
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
    const returnUrl = `${process.env.FRONTEND_URL}/planos`;

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
