// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
// import { formatDate } from "../utils/format.js"; // Removido - função não existe
import { verifyToken } from "../middleware/auth.js";
import { sendEmail } from "../services/notify.js";

const router = express.Router();

// ================== PERFIL DO UTILIZADOR ==================
// Rota /profile (alias para /me) - REMOVIDA (duplicada)
// A rota principal está na linha 162

router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Info do utilizador
    const [users] = await pool.query(
      "SELECT Id, Nome, Email, Telefone, Data_Registo, FotoPerfil FROM Utilizadores WHERE Id = ?",
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
        DataCriacao: user.Data_Registo ? new Date(user.Data_Registo).toLocaleDateString('pt-BR') : 'N/A' //  Data formatada
      },
      stats: {
        ...statsRows[0],
        dinheiro_poupado: Number(statsRows[0].dinheiro_poupado) || 0
      },
      notificacoes: notificacoes.map(n => ({
        ...n,
        DataEnvio: formatDate(n.DataEnvio) //  Data formatada
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
    console.log(" [BACKEND] Buscando perfil para userId:", userId);

    // Dados pessoais
    const [userRows] = await pool.query(
      "SELECT Nome, Email, Telefone, FotoPerfil FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    console.log(" [BACKEND] Dados do usuário encontrados:", userRows);

    if (userRows.length === 0) {
      console.log(" [BACKEND] Usuário não encontrado para userId:", userId);
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }

    // Contas conectadas - verificando email, telefone e discord_id
    let contas = [];
    try {
      // Verificar se a coluna discord_id existe antes de usar
      const [contasRows] = await pool.query(
        "SELECT 'email' as Tipo, CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END as Conectado FROM Utilizadores WHERE Id = ? " +
        "UNION SELECT 'telefone', CASE WHEN Telefone IS NOT NULL AND Telefone != '' THEN 1 ELSE 0 END FROM Utilizadores WHERE Id = ?",
        [userId, userId]
      );
      
      // Tentar adicionar verificação do Discord (pode falhar se a coluna não existir)
      try {
        const [discordRow] = await pool.query(
          "SELECT 'discord' as Tipo, CASE WHEN discord_id IS NOT NULL AND discord_id != '' THEN 1 ELSE 0 END as Conectado FROM Utilizadores WHERE Id = ?",
          [userId]
        );
        contas = [...contasRows, ...discordRow];
      } catch (discordError) {
        // Se a coluna discord_id não existir, apenas usar email e telefone
        console.log(" [BACKEND] Coluna discord_id não encontrada, usando apenas email e telefone");
        contas = contasRows;
        // Adicionar Discord como não conectado
        contas.push({ Tipo: 'discord', Conectado: 0 });
      }
    } catch (err) {
      console.error(" [BACKEND] Erro ao buscar contas conectadas:", err);
      // Retornar valores padrão em caso de erro
      contas = [
        { Tipo: 'email', Conectado: 0 },
        { Tipo: 'telefone', Conectado: 0 },
        { Tipo: 'discord', Conectado: 0 }
      ];
    }

    // Preferências
    const [prefs] = await pool.query(
      "SELECT Tipo, Ativo FROM PreferenciasNotificacao WHERE UserId = ?",
      [userId]
    );

    const response = {
      status: "ok",
      profile: {
        nome: userRows[0]?.Nome,
        email: userRows[0]?.Email,
        telefone: userRows[0]?.Telefone,
        FotoPerfil: userRows[0]?.FotoPerfil,
        contas_conectadas: contas,
        preferencias: prefs
      }
    };

    console.log(" [BACKEND] Resposta do perfil:", response);
    res.json(response);
  } catch (err) {
    console.error(" [BACKEND] Erro ao buscar perfil:", err);
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

// ================== ATUALIZAR USUÁRIO POR ID (ADMIN) ==================
// IMPORTANTE: Esta rota deve vir ANTES de rotas paramétricas genéricas
// mas DEPOIS de rotas específicas como /admins, /profile, etc.
router.put("/admin/:id", verifyToken, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    
    // Verificar se o usuário atual é admin
    const [currentUser] = await pool.query(
      "SELECT PerfilId FROM Utilizadores WHERE Id = ?",
      [currentUserId]
    );
    
    if (currentUser.length === 0 || currentUser[0].PerfilId !== 1) {
      return res.status(403).json({
        status: "error",
        error: "Apenas administradores podem atualizar outros usuários"
      });
    }
    
    // Verificar se o usuário alvo existe
    const [targetUser] = await pool.query(
      "SELECT Id FROM Utilizadores WHERE Id = ?",
      [targetUserId]
    );
    
    if (targetUser.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado"
      });
    }
    
    const { nome, email, telefone } = req.body;
    
    // Validar campos
    if (!nome || !email) {
      return res.status(400).json({
        status: "error",
        error: "Nome e email são obrigatórios"
      });
    }
    
    // Verificar se o email já está em uso por outro usuário
    const [emailCheck] = await pool.query(
      "SELECT Id FROM Utilizadores WHERE Email = ? AND Id != ?",
      [email, targetUserId]
    );
    
    if (emailCheck.length > 0) {
      return res.status(400).json({
        status: "error",
        error: "Este email já está em uso por outro usuário"
      });
    }
    
    // Atualizar usuário
    await pool.query(
      "UPDATE Utilizadores SET Nome = ?, Email = ?, Telefone = ? WHERE Id = ?",
      [nome, email, telefone || null, targetUserId]
    );
    
    // Buscar usuário atualizado
    const [updatedUser] = await pool.query(
      `SELECT 
         u.Id,
         u.Nome,
         u.Email,
         u.Data_Registo AS DataRegisto,
         p.Nome AS Perfil
       FROM Utilizadores u
       LEFT JOIN perfis p ON p.Id = u.PerfilId
       WHERE u.Id = ?`,
      [targetUserId]
    );
    
    res.json({
      status: "ok",
      message: "Usuário atualizado com sucesso",
      user: updatedUser[0]
    });
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
    res.status(500).json({
      status: "error",
      error: "Erro ao atualizar usuário",
      message: err.message
    });
  }
});

// GET estatísticas do utilizador
router.get("/stats", verifyToken, async (req, res) => {
  console.log("[STATS] ===== ROTA /api/user/stats CHAMADA =====");
  try {
    const userId = req.user.id;
    console.log("[STATS] UserId extraído do token:", userId);

    // Buscar estatísticas e data de registro separadamente
    const [statsRows] = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM Produtos WHERE UserId = ?) AS produtos_total,
          (SELECT COUNT(*) FROM Notificacoes WHERE UserId = ?) AS notificacoes_total,
          (SELECT COALESCE(SUM(ValorPoupado),0) FROM Notificacoes WHERE UserId = ?) AS dinheiro_poupado`,
      [userId, userId, userId]
    );

    // Buscar data de registro diretamente
    const [userRows] = await pool.query(
      "SELECT Data_Registo FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    console.log("[STATS] UserId usado:", userId);
    console.log("[STATS] Dados de estatísticas:", statsRows[0]);
    console.log("[STATS] userRows completo:", userRows);
    console.log("[STATS] userRows[0]:", userRows[0]);
    console.log("[STATS] Data_Registo raw:", userRows[0]?.Data_Registo);
    console.log("[STATS] Tipo de Data_Registo:", typeof userRows[0]?.Data_Registo);

    // Formatar data de registro
    let membro_desde = "N/A";
    if (userRows && userRows.length > 0 && userRows[0]) {
      const dataRegistoRaw = userRows[0].Data_Registo;
      
      if (dataRegistoRaw) {
        try {
          // Se for um objeto Date do MySQL, converter para string primeiro
          let dataString = dataRegistoRaw;
          if (dataRegistoRaw instanceof Date) {
            dataString = dataRegistoRaw.toISOString();
          } else if (typeof dataRegistoRaw === 'object' && dataRegistoRaw.toISOString) {
            dataString = dataRegistoRaw.toISOString();
          } else if (typeof dataRegistoRaw === 'string') {
            dataString = dataRegistoRaw;
          }
          
          console.log("[STATS] Data string para conversão:", dataString);
          const dataRegisto = new Date(dataString);
          console.log("[STATS] Data convertida:", dataRegisto);
          console.log("[STATS] isValid:", !isNaN(dataRegisto.getTime()));
          
          if (!isNaN(dataRegisto.getTime())) {
            membro_desde = dataRegisto.toLocaleDateString("pt-PT", {
              year: "numeric",
              month: "long"
            });
            // Capitalizar primeira letra do mês
            membro_desde = membro_desde.charAt(0).toUpperCase() + membro_desde.slice(1);
            console.log("[STATS] Data formatada:", membro_desde);
          } else {
            console.log("[STATS] Data inválida após conversão");
          }
        } catch (dateErr) {
          console.error("[STATS] Erro ao formatar data:", dateErr);
          console.error("[STATS] Stack:", dateErr.stack);
        }
      } else {
        console.log("[STATS] Data_Registo é null, undefined ou vazio");
      }
    } else {
      console.log("[STATS] userRows vazio ou não encontrado");
    }

    // Garantir que membro_desde sempre tenha um valor
    const membroDesdeFinal = membro_desde && membro_desde !== "N/A" ? membro_desde : "N/A";
    
    const responseData = {
      status: "ok",
      stats: {
        produtos_total: statsRows[0]?.produtos_total || 0,
        notificacoes_total: statsRows[0]?.notificacoes_total || 0,
        dinheiro_poupado: Number(statsRows[0]?.dinheiro_poupado) || 0,
        membro_desde: membroDesdeFinal
      }
    };

    console.log("[STATS] membro_desde antes de enviar:", membro_desde);
    console.log("[STATS] membroDesdeFinal:", membroDesdeFinal);
    console.log("[STATS] Resposta final sendo enviada:", JSON.stringify(responseData, null, 2));
    console.log("[STATS] membro_desde no objeto stats:", responseData.stats.membro_desde);
    console.log("[STATS] Verificando se membro_desde existe:", 'membro_desde' in responseData.stats);

    res.json(responseData);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ================== LISTAR ADMINISTRADORES ==================
router.get("/admins", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         u.Id,
         u.Nome,
         u.Email,
         u.Data_Registo AS DataRegisto,
         u.FotoPerfil,
         u.discord_id,
         p.Nome AS Perfil
       FROM Utilizadores u
       LEFT JOIN perfis p ON p.Id = u.PerfilId
       WHERE (p.Nome LIKE 'Admin%' OR u.PerfilId = 1) AND u.Ativo = 1
       ORDER BY COALESCE(u.Data_Registo, NOW()) DESC
       LIMIT 200`
    );

    res.json({ status: "ok", admins: rows, total: rows.length });
  } catch (err) {
    console.error("Erro ao listar admins:", err);
    res.status(500).json({ status: "error", error: "Erro ao listar admins" });
  }
});

// POST alterar senha do utilizador (requer senha atual)
router.post("/change-password", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        status: "error", 
        error: "Senha atual e nova senha são obrigatórias" 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        status: "error", 
        error: "A nova senha deve ter pelo menos 6 caracteres" 
      });
    }

    // Buscar senha atual do usuário
    const [users] = await pool.query(
      "SELECT SenhaHash FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        error: "Usuário não encontrado" 
      });
    }

    const user = users[0];

    // Verificar se o usuário tem senha cadastrada
    if (!user.SenhaHash) {
      return res.status(400).json({ 
        status: "error", 
        error: "Você ainda não tem uma senha cadastrada. Use a opção de configurar senha." 
      });
    }

    // Verificar senha atual
    const bcrypt = await import('bcrypt');
    const isPasswordValid = await bcrypt.compare(currentPassword, user.SenhaHash);

    if (!isPasswordValid) {
      return res.status(400).json({ 
        status: "error", 
        error: "Senha atual incorreta" 
      });
    }

    // Verificar se a nova senha é diferente da atual
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        status: "error", 
        error: "A nova senha deve ser diferente da senha atual" 
      });
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha na base de dados
    await pool.query(
      "UPDATE Utilizadores SET SenhaHash = ? WHERE Id = ?",
      [hashedPassword, userId]
    );

    res.json({ 
      status: "ok", 
      message: "Senha alterada com sucesso" 
    });
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    res.status(500).json({ 
      status: "error", 
      error: "Erro interno no servidor" 
    });
  }
});

// POST configurar senha para utilizador (primeira vez - sem senha atual)
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

    // Verificar se já tem senha
    const [users] = await pool.query(
      "SELECT SenhaHash FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (users.length > 0 && users[0].SenhaHash) {
      return res.status(400).json({ 
        status: "error", 
        error: "Você já tem uma senha cadastrada. Use a opção de alterar senha." 
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

// ================== UPLOAD DE FOTO DE PERFIL ==================
router.post("/upload-photo", verifyToken, async (req, res) => {
  try {
    console.log("[UPLOAD-PHOTO] Rota chamada");
    const userId = req.user.id;
    const { photo_url } = req.body;
    console.log("[UPLOAD-PHOTO] UserId:", userId, "Photo URL length:", photo_url?.length || 0);

    if (!photo_url) {
      return res.status(400).json({ 
        status: "error", 
        message: "URL da foto não fornecida" 
      });
    }

    // Verificar se a coluna FotoPerfil existe antes de atualizar
    try {
      await pool.query(
        "UPDATE Utilizadores SET FotoPerfil = ? WHERE Id = ?",
        [photo_url, userId]
      );
      
      res.json({ 
        status: "ok", 
        message: "Foto atualizada com sucesso",
        photo_url: photo_url
      });
    } catch (updateErr) {
      // Se a coluna não existir, retornar erro
      if (updateErr.code === 'ER_BAD_FIELD_ERROR') {
        console.log("Coluna FotoPerfil não existe na tabela Utilizadores");
        return res.status(400).json({ 
          status: "error", 
          message: "Funcionalidade de foto de perfil não disponível" 
        });
      }
      throw updateErr;
    }
  } catch (err) {
    console.error("Erro ao fazer upload da foto:", err);
    res.status(500).json({ 
      status: "error", 
      message: err.message || "Erro ao fazer upload da foto" 
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

    console.log(" [BACKEND] Verificando cancelamentos para userId:", userId);
    console.log(" [BACKEND] Stripe rows encontradas:", stripeRows.length);

    if (stripeRows.length > 0) {
      console.log(" [BACKEND] Cancelamento ativo encontrado:", stripeRows[0]);
      
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

      console.log(" [BACKEND] Plano original encontrado:", originalPlanRows);

      if (originalPlanRows.length > 0) {
        console.log(" [BACKEND] Retornando período de graça");
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
      console.log(" [BACKEND] Nenhum cancelamento ativo encontrado");
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

    console.log(" Alterando plano para userId:", userId, "planoId:", planoId);

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

    console.log(" Plano alterado com sucesso");

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

// ================== BUSCAR PLANOS ==================
router.get("/planos", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar todos os planos
    const [planos] = await pool.query(
      "SELECT * FROM planos ORDER BY Preco ASC"
    );

    // Buscar plano atual do usuário
    const [userConfig] = await pool.query(
      "SELECT PlanoAtualId FROM configutilizador WHERE UserId = ?",
      [userId]
    );

    const userPlanId = userConfig.length > 0 ? userConfig[0].PlanoAtualId : 1;

    console.log(" Planos carregados:", planos.length);
    console.log(" Plano atual do usuário:", userPlanId);

    res.json({
      status: "success",
      planos: planos,
      userPlanId: userPlanId
    });
  } catch (error) {
    console.error(" Erro ao buscar planos:", error);
    res.status(500).json({
      status: "error",
      error: "Erro interno do servidor"
    });
  }
});

// ================== ALTERAR PLANO ==================
router.post("/change-plan", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        status: "error",
        error: "ID do plano é obrigatório"
      });
    }

    // Verificar se o plano existe
    const [planoRows] = await pool.query(
      "SELECT * FROM planos WHERE Id = ?",
      [planId]
    );

    if (planoRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Plano não encontrado"
      });
    }

    const plano = planoRows[0];

    // Atualizar plano do usuário
    await pool.query(
      "UPDATE configutilizador SET PlanoAtualId = ?, LimiteProdutos = ? WHERE UserId = ?",
      [planId, plano.LimiteProdutos, userId]
    );

    console.log(` Plano alterado para ${plano.Nome} (ID: ${planId}) para usuário ${userId}`);

    res.json({
      status: "success",
      message: "Plano alterado com sucesso",
      plano: {
        id: plano.Id,
        nome: plano.Nome,
        preco: plano.Preco,
        limite_produtos: plano.LimiteProdutos
      }
    });
  } catch (error) {
    console.error(" Erro ao alterar plano:", error);
    res.status(500).json({
      status: "error",
      error: "Erro interno do servidor"
    });
  }
});

// ================== CANCELAR ASSINATURA ==================
router.post("/cancel-subscription", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar configuração atual do usuário
    const [userConfig] = await pool.query(
      "SELECT * FROM configutilizador WHERE UserId = ?",
      [userId]
    );

    if (userConfig.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado"
      });
    }

    const config = userConfig[0];

    // Se já está em período de graça, não fazer nada
    if (config.StatusAssinatura === 'PeriodoGraca') {
      return res.json({
        status: "success",
        message: "Assinatura já está cancelada e em período de graça"
      });
    }

    // Calcular data de expiração do período de graça (30 dias)
    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

    // Atualizar status para período de graça
    await pool.query(
      `UPDATE configutilizador 
       SET StatusAssinatura = 'PeriodoGraca', 
           DataExpiracao = ?,
           DataCancelamento = NOW()
       WHERE UserId = ?`,
      [gracePeriodEnd, userId]
    );

    console.log(` Assinatura cancelada para usuário ${userId}. Período de graça até: ${gracePeriodEnd}`);

    res.json({
      status: "success",
      message: "Assinatura cancelada com sucesso",
      grace_period_end: gracePeriodEnd
    });
  } catch (error) {
    console.error(" Erro ao cancelar assinatura:", error);
    res.status(500).json({
      status: "error",
      error: "Erro interno do servidor"
    });
  }
});

// ================== DESATIVAR CONTA ==================
router.post("/deactivate", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar dados do usuário antes de desativar
    const [userRows] = await pool.query(
      "SELECT Nome, Email FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado"
      });
    }

    const user = userRows[0];
    const userName = user.Nome || "Usuário";
    const userEmail = user.Email;

    // Calcular data de expiração (20 dias a partir de agora)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 20);
    const expirationDateStr = expirationDate.toISOString().slice(0, 19).replace('T', ' ');

    // Enviar email de confirmação de desativação
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <div style="background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: #856404; margin: 0;">Conta Desativada</h2>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Olá <b>${userName}</b>,</p>
            <p>Sua conta no <b>PromoPing</b> foi desativada com sucesso.</p>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #856404;"><strong>Importante:</strong> Você tem 20 dias para reativar sua conta fazendo login novamente.</p>
            </div>
            <p style="color: #856404; font-weight: 600;">Após 20 dias, sua conta será permanentemente excluída e não poderá ser recuperada.</p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              <strong>Data de expiração:</strong> ${expirationDate.toLocaleDateString('pt-PT', { dateStyle: 'long' })}
            </p>
            <p>Se você não solicitou esta ação, entre em contato conosco imediatamente através do suporte.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #666; font-size: 14px; text-align: center;">
              &copy; ${new Date().getFullYear()} PromoPing - Todos os direitos reservados
            </p>
          </div>
        </div>
      `;

      await sendEmail(userEmail, "PromoPing - Conta Desativada", emailHtml);
      console.log(`[USER] Email de desativação enviado para ${userEmail}`);
    } catch (emailError) {
      console.error("[USER] Erro ao enviar email de desativação:", emailError);
      // Não falhar a operação se o email não for enviado
    }

    // Marcar conta como desativada com data de desativação
    // Verificar se a coluna DataDesativacao existe, se não, criar
    try {
      // Tentar atualizar com DataDesativacao
      await pool.query(
        "UPDATE Utilizadores SET Ativo = 0, DataDesativacao = ? WHERE Id = ?",
        [expirationDateStr, userId]
      );
    } catch (error) {
      // Se a coluna não existir (erro 1054 = Unknown column), criar
      if (error.code === 'ER_BAD_FIELD_ERROR' || error.message?.includes('Unknown column')) {
        try {
          console.log("[USER] Coluna DataDesativacao não existe, criando...");
          await pool.query(
            "ALTER TABLE Utilizadores ADD COLUMN DataDesativacao DATETIME NULL AFTER Ativo"
          );
          // Tentar atualizar novamente
          await pool.query(
            "UPDATE Utilizadores SET Ativo = 0, DataDesativacao = ? WHERE Id = ?",
            [expirationDateStr, userId]
          );
          console.log("[USER] Coluna DataDesativacao criada e conta desativada com sucesso");
        } catch (alterError) {
          // Se falhar ao criar (pode já existir), apenas desativar
          console.warn("[USER] Erro ao criar DataDesativacao:", alterError.message);
          await pool.query(
            "UPDATE Utilizadores SET Ativo = 0 WHERE Id = ?",
            [userId]
          );
        }
      } else {
        // Outro tipo de erro, apenas desativar
        console.error("[USER] Erro ao desativar conta com data:", error.message);
        await pool.query(
          "UPDATE Utilizadores SET Ativo = 0 WHERE Id = ?",
          [userId]
        );
      }
    }

    console.log(`[USER] Conta desativada para usuário ${userId}. Expira em: ${expirationDateStr}`);

    res.json({
      status: "ok",
      message: "Conta desativada com sucesso",
      expirationDate: expirationDateStr,
      daysRemaining: 20
    });
  } catch (error) {
    console.error("Erro ao desativar conta:", error);
    res.status(500).json({
      status: "error",
      error: "Erro interno do servidor"
    });
  }
});

// ================== EXCLUIR CONTA ==================
router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar dados do usuário ANTES de deletar (precisamos do email para enviar confirmação)
    const [userRows] = await pool.query(
      "SELECT Nome, Email FROM Utilizadores WHERE Id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Usuário não encontrado"
      });
    }

    const user = userRows[0];
    const userName = user.Nome || "Usuário";
    const userEmail = user.Email;

    // Enviar email de confirmação de exclusão ANTES de deletar
    try {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <div style="background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h2 style="color: #721c24; margin: 0;">Conta Excluída Permanentemente</h2>
          </div>
          <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Olá <b>${userName}</b>,</p>
            <p>Confirmamos que sua conta no <b>PromoPing</b> foi excluída permanentemente.</p>
            <div style="background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #721c24;"><strong>Atenção:</strong> Esta ação é permanente e não pode ser desfeita.</p>
            </div>
            <p>Os seguintes dados foram removidos permanentemente:</p>
            <ul style="color: #666; line-height: 1.8;">
              <li>Seus produtos monitorizados</li>
              <li>Histórico de notificações</li>
              <li>Configurações e preferências</li>
              <li>Assinaturas ativas</li>
              <li>Todos os dados da sua conta</li>
            </ul>
            <p>Se você não solicitou esta ação, entre em contato conosco imediatamente através do suporte.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              <strong>Data da exclusão:</strong> ${new Date().toLocaleString('pt-PT', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #666; font-size: 14px; text-align: center;">
              &copy; ${new Date().getFullYear()} PromoPing - Todos os direitos reservados
            </p>
          </div>
        </div>
      `;

      await sendEmail(userEmail, "PromoPing - Conta Excluída", emailHtml);
      console.log(`[USER] Email de exclusão enviado para ${userEmail}`);
    } catch (emailError) {
      console.error("[USER] Erro ao enviar email de exclusão:", emailError);
      // Não falhar a operação se o email não for enviado, mas logar o erro
    }

    // Iniciar transação para garantir que tudo seja deletado
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. Deletar produtos do usuário
      await connection.query("DELETE FROM Produtos WHERE UserId = ?", [userId]);

      // 2. Deletar configurações do usuário
      await connection.query("DELETE FROM configutilizador WHERE UserId = ?", [userId]);

      // 3. Deletar preferências de notificação
      await connection.query("DELETE FROM preferenciasnotificacao WHERE UserId = ?", [userId]);

      // 4. Deletar contas conectadas
      await connection.query("DELETE FROM contasconectadas WHERE UserId = ?", [userId]);

      // 5. Deletar assinaturas Stripe relacionadas
      await connection.query("DELETE FROM stripe_subscriptions WHERE user_id = ?", [userId]);

      // 6. Deletar histórico de notificações
      await connection.query("DELETE FROM notificacoes WHERE UserId = ?", [userId]);

      // 7. Deletar mensagens de suporte
      await connection.query("DELETE FROM supportmessages WHERE userId = ?", [userId]);

      // 8. Deletar tokens de recuperação de senha (já tem CASCADE, mas deletamos explicitamente para garantir)
      await connection.query("DELETE FROM recuperar_senha WHERE UserId = ?", [userId]);

      // 9. Finalmente, deletar o usuário (isso também deleta automaticamente via CASCADE: recuperar_senha, historicoprecos via produtos)
      await connection.query("DELETE FROM Utilizadores WHERE Id = ?", [userId]);

      await connection.commit();
      connection.release();

      console.log(`[USER] Conta completamente excluída para usuário ${userId}`);

      res.json({
        status: "ok",
        message: "Conta excluída com sucesso"
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Erro ao excluir conta:", error);
    res.status(500).json({
      status: "error",
      error: "Erro interno do servidor"
    });
  }
});

export default router;
