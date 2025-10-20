// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ================== PERFIL DO UTILIZADOR ==================
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Info do utilizador
    const [users] = await pool.query(
      "SELECT Id, Nome, Email, Telefone, DataRegisto FROM Utilizadores WHERE Id = ?",
      [userId]
    );
    const user = users[0];

    // Estatísticas
    const [statsRows] = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM Produtos WHERE UserId = ?) AS produtos_total,
          (SELECT COUNT(*) FROM Notificacoes WHERE UserId = ?) AS notificacoes_total,
          (SELECT COALESCE(SUM(ValorPoupado),0) FROM Notificacoes WHERE UserId = ?) AS dinheiro_poupado`,
      [userId, userId, userId]
    );

    // Histórico notificações
    const [notificacoes] = await pool.query(
      `SELECT Id, Tipo, Mensagem, DataEnvio, ValorPoupado 
       FROM Notificacoes 
       WHERE UserId = ? 
       ORDER BY DataEnvio DESC 
       LIMIT 20`,
      [userId]
    );

    res.json({
      status: "ok",
      user: {
        ...user,
        DataRegisto: formatDate(user.DataRegisto) // 🔹 Data formatada
      },
      stats: {
        ...statsRows[0],
        dinheiro_poupado: Number(statsRows[0].dinheiro_poupado) || 0
      },
      notificacoes: notificacoes.map(n => ({
        ...n,
        DataEnvio: formatDate(n.DataEnvio) // 🔹 Data formatada
      }))
    });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

// GET perfil completo com contas conectadas e preferências
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Dados pessoais
    const [userRows] = await pool.query(
      "SELECT Nome, Email, Telefone FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    // Contas conectadas - usando apenas colunas que existem
    const [contas] = await pool.query(
      "SELECT 'email' as Tipo, Email IS NOT NULL as Conectado FROM Utilizadores WHERE Id = ? " +
      "UNION SELECT 'telefone', Telefone IS NOT NULL FROM Utilizadores WHERE Id = ?",
      [userId, userId]
    );

    // Preferências
    const [prefs] = await pool.query(
      "SELECT Tipo, Ativo FROM PreferenciasNotificacao WHERE UserId = ?",
      [userId]
    );

    res.json({
      status: "ok",
      profile: {
        nome: userRows[0]?.Nome,
        email: userRows[0]?.Email,
        telefone: userRows[0]?.Telefone,
        contas_conectadas: contas,
        preferencias: prefs
      }
    });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// PUT atualizar perfil
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { nome, email, telefone } = req.body;

    await pool.query(
      "UPDATE Utilizadores SET Nome=?, Email=?, Telefone=? WHERE Id=?",
      [nome, email, telefone, userId]
    );

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// PUT atualizar perfil (rota antiga mantida para compatibilidade)
router.put("/me", verifyToken, async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });

    await pool.query("UPDATE Utilizadores SET Nome=? WHERE Id=?", [
      nome,
      req.user.id,
    ]);

    res.json({ status: "ok", message: "Perfil atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// GET estatísticas do utilizador
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Estatísticas do utilizador
    const [rows] = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM Produtos WHERE UserId = ?) AS produtos_total,
          (SELECT COUNT(*) FROM Notificacoes WHERE UserId = ?) AS notificacoes_total,
          (SELECT COALESCE(SUM(ValorPoupado),0) FROM Notificacoes WHERE UserId = ?) AS dinheiro_poupado`,
      [userId, userId, userId]
    );

    res.json({ 
      status: "ok", 
      stats: {
        ...rows[0],
        dinheiro_poupado: Number(rows[0].dinheiro_poupado) || 0
      }
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// POST configurar senha para utilizador
router.post("/set-password", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        status: "error", 
        error: "A senha deve ter pelo menos 6 caracteres" 
      });
    }

    // Hash da senha
    const bcrypt = await import('bcrypt');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Atualizar senha na base de dados
    await pool.query(
      "UPDATE Utilizadores SET SenhaHash = ? WHERE Id = ?",
      [hashedPassword, userId]
    );

    res.json({ 
      status: "ok", 
      message: "Senha configurada com sucesso" 
    });
  } catch (err) {
    console.error("Erro ao configurar senha:", err);
    res.status(500).json({ 
      status: "error", 
      error: "Erro interno no servidor" 
    });
  }
});

// ================== RESETAR HISTÓRICO ==================
router.delete("/notificacoes/reset", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await pool.query("DELETE FROM Notificacoes WHERE UserId = ?", [userId]);
    res.json({ status: "ok", message: "Histórico de notificações limpo com sucesso!" });
  } catch (err) {
    console.error("Erro ao resetar notificações:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

// ================== INFORMAÇÕES DO PLANO ==================
router.get("/plano", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id; // vindo do middleware de autenticação

    // Primeiro, verificar se há cancelamento ativo
    const [stripeRows] = await pool.query(`
      SELECT 
        subscription_status,
        plan_name,
        grace_period_end,
        status
      FROM stripe_subscriptions 
      WHERE user_id = ? AND status = 'canceled' AND grace_period_end > NOW()
    `, [userId]);

    console.log("🔍 [BACKEND] Verificando cancelamentos para userId:", userId);
    console.log("🔍 [BACKEND] Stripe rows encontradas:", stripeRows.length);

    if (stripeRows.length > 0) {
      console.log("✅ [BACKEND] Cancelamento ativo encontrado:", stripeRows[0]);
      
      // Usuário em período de graça - mostrar plano original
      const stripeData = stripeRows[0];
      const [originalPlanRows] = await pool.query(`
        SELECT 
          p.Id AS id,
          p.Nome AS nome,
          p.Preco AS preco,
          p.IntervaloVerificacao AS verificacao_intervalo,
          p.LimiteProdutos AS limite_produtos,
          'PeriodoGraca' AS status,
          ? AS expiracao
        FROM planos p
        WHERE p.Nome = ?
      `, [stripeData.grace_period_end, stripeData.plan_name]);

      console.log("🔍 [BACKEND] Plano original encontrado:", originalPlanRows);

      if (originalPlanRows.length > 0) {
        console.log("✅ [BACKEND] Retornando período de graça");
        return res.json({
          status: "ok",
          plano: originalPlanRows[0],
          is_in_grace_period: true,
          grace_period_end: stripeData.grace_period_end,
          customer_id: null, // Não tem customer ativo durante graça
          subscription_id: null
        });
      }
    } else {
      console.log("❌ [BACKEND] Nenhum cancelamento ativo encontrado");
    }

    // Se não está em período de graça, buscar plano atual
    const [rows] = await pool.query(`
      SELECT 
        p.Id AS id,
        p.Nome AS nome,
        p.Preco AS preco,
        p.IntervaloVerificacao AS verificacao_intervalo,
        p.LimiteProdutos AS limite_produtos,
        c.StatusAssinatura AS status,
        c.DataExpiracao AS expiracao
      FROM configutilizador c
      JOIN planos p ON c.PlanoAtualId = p.Id
      WHERE c.UserId = ?;
    `, [userId]);

    if (rows.length === 0) {
      return res.json({ status: "erro", message: "Utilizador sem plano ativo." });
    }

    // Verificar se tem customer_id ativo
    const [customerRows] = await pool.query(`
      SELECT customer_id, subscription_id
      FROM stripe_subscriptions 
      WHERE user_id = ? AND status = 'active'
    `, [userId]);

    res.json({
      status: "ok",
      plano: rows[0],
      is_in_grace_period: false,
      grace_period_end: null,
      customer_id: customerRows.length > 0 ? customerRows[0].customer_id : null,
      subscription_id: customerRows.length > 0 ? customerRows[0].subscription_id : null
    });
  } catch (err) {
    console.error("Erro ao buscar plano:", err);
    res.status(500).json({ status: "erro", message: "Erro no servidor ao buscar plano." });
  }
});

// ================== ALTERAR PLANO ==================
router.post("/plano/alterar", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planoId, session_id } = req.body;

    console.log("🔄 Alterando plano para userId:", userId, "planoId:", planoId);

    // Validar plano
    const [planoRows] = await pool.query(
      `SELECT * FROM planos WHERE Id = ?`,
      [planoId]
    );

    if (planoRows.length === 0) {
      return res.status(400).json({ 
        status: "error", 
        error: "Plano inválido" 
      });
    }

    const plano = planoRows[0];

    // Se for plano gratuito, ativar diretamente
    if (plano.Preco === 0) {
      await pool.query(
        `UPDATE configutilizador 
         SET PlanoAtualId = ?, LimiteProdutos = ?
         WHERE UserId = ?`,
        [planoId, plano.LimiteProdutos, userId]
      );

      return res.json({
        status: "ok",
        message: "Plano gratuito ativado com sucesso",
        plano: {
          nome: plano.Nome,
          preco: plano.Preco,
          limite_produtos: plano.LimiteProdutos
        }
      });
    }

    // Para planos pagos, verificar se tem session_id
    if (!session_id) {
      return res.status(400).json({
        status: "error",
        error: "Session ID é obrigatório para planos pagos"
      });
    }

    // Verificar status da sessão de pagamento
    const stripe = (await import('../config/stripe.js')).default;
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        status: "error",
        error: "Pagamento não foi processado com sucesso"
      });
    }

    // Atualizar plano do utilizador
    await pool.query(
      `UPDATE configutilizador 
       SET PlanoAtualId = ?, LimiteProdutos = ?, StripeSubscriptionId = ?
       WHERE UserId = ?`,
      [planoId, plano.LimiteProdutos, session.subscription, userId]
    );

    console.log("✅ Plano alterado com sucesso");

    res.json({
      status: "ok",
      message: "Plano alterado com sucesso",
      plano: {
        nome: plano.Nome,
        preco: plano.Preco,
        limite_produtos: plano.LimiteProdutos
      }
    });
  } catch (err) {
    console.error("Erro ao alterar plano:", err);
    res.status(500).json({ 
      status: "error", 
      error: "Erro no servidor" 
    });
  }
});

export default router;
