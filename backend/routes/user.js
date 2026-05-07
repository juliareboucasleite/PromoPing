// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
// import { formatDate } from "../utils/format.js"; // Removido - função não existe
import { verifyToken } from "../middleware/auth.js";
import { sendEmail } from "../services/notify.js";
import {
  getStatus,
  is2FAEnabled,
  startSetup,
  verifyAndEnable,
  verifyCode,
  disable,
  sendEmailCode
} from "../services/twoFactorService.js";

const router = express.Router();

const PLAN_SELECT_FIELDS = `
  id,
  nome,
  preco,
  limiteprodutos,
  historicodias,
  intervaloverificacao,
  permitesms,
  relatorios,
  linksplanos,
  linksplanosanual,
  precoanual
`;

const CONFIG_SELECT_FIELDS = `
  id,
  referenciaid,
  planoatualid,
  planoativoid,
  datainicio,
  datacancelamento,
  dataexpiracao,
  statusassinatura,
  limiteprodutos,
  canalpreferido,
  notificacoesenviadas,
  historicoativo,
  ultimologin,
  historicodias
`;

// Rota /profile (alias para /me) - REMOVIDA (duplicada)
// A rota principal está na linha 162

router.get("/me", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;

    // Info do utilizador
    const [users] = await pool.query(
      'SELECT ReferenciaID AS "ReferenciaID", Nome AS "Nome", Email AS "Email", Telefone AS "Telefone", DataRegisto AS "DataRegisto", FotoPerfil AS "FotoPerfil" FROM utilizadores WHERE ReferenciaID = ?',
      [referenciaID]
    );
    const user = users[0];

    // Estatísticas (dinheiro_poupado vem da coluna em utilizadores)
    const [statsRows] = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM produtos WHERE ReferenciaID = ?) AS produtos_total,
          (SELECT COUNT(*) FROM notificacoes WHERE ReferenciaID = ?) AS notificacoes_total,
          (SELECT COALESCE(u.dinheiro_poupado,0) FROM utilizadores u WHERE u.ReferenciaID = ? LIMIT 1) AS dinheiro_poupado`,
      [referenciaID, referenciaID, referenciaID]
    );

    // Histórico notificações
    const [notificacoes] = await pool.query(
      `SELECT Id, Tipo, Mensagem, DataEnvio, ValorPoupado 
       FROM notificacoes 
       WHERE ReferenciaID = ? 
       ORDER BY DataEnvio DESC 
       LIMIT 20`,
      [referenciaID]
    );

    res.json({
      status: "ok",
      user: {
        ...user,
        DataCriacao: user.DataRegisto ? new Date(user.DataRegisto).toLocaleDateString('pt-BR') : 'N/A' //  Data formatada
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
    const referenciaID = req.user.ReferenciaID;
    console.log(" [BACKEND] Buscando perfil para ReferenciaID:", referenciaID);

    // Dados pessoais (inclui datas de última alteração para cooldown de 30 dias)
    let userRows;
    try {
      [userRows] = await pool.query(
        'SELECT Nome AS "Nome", Email AS "Email", Telefone AS "Telefone", FotoPerfil AS "FotoPerfil", PerfilId AS "PerfilId", UltimaAlteracaoSenha AS "UltimaAlteracaoSenha", UltimaAlteracaoNome AS "UltimaAlteracaoNome", DataNascimento AS "DataNascimento" FROM utilizadores WHERE ReferenciaID = ?',
        [referenciaID]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        [userRows] = await pool.query(
          'SELECT Nome AS "Nome", Email AS "Email", Telefone AS "Telefone", FotoPerfil AS "FotoPerfil", PerfilId AS "PerfilId", DataNascimento AS "DataNascimento" FROM utilizadores WHERE ReferenciaID = ?',
          [referenciaID]
        );
    } else throw colErr;
    }

    console.log("Dados do usuário encontrados:", userRows);

    if (userRows.length === 0) {
      console.warn("Usuário não encontrado para ReferenciaID:", referenciaID, " - token válido mas sem usuário correspondente");
      // Retornar 401 para forçar re-login se o token não mapear para um utilizador válido
      return res.status(401).json({ error: "Token inválido ou utilizador não encontrado" });
    }

    // Contas conectadas - verificando email, telefone e discord
    let contas = [];
    try {
      // Verificar email e telefone da tabela utilizadores
      const [contasRows] = await pool.query(
        "SELECT 'email' as Tipo, CASE WHEN Email IS NOT NULL AND Email != '' THEN 1 ELSE 0 END as Conectado FROM utilizadores WHERE ReferenciaID = ? " +
        "UNION SELECT 'telefone', CASE WHEN Telefone IS NOT NULL AND Telefone != '' THEN 1 ELSE 0 END FROM utilizadores WHERE ReferenciaID = ?",
        [referenciaID, referenciaID]
      );
      
      // Verificar Discord: primeiro na tabela contasconectadas, depois na coluna discord_id
      let discordConectado = 0;
      try {
        // Verificar na tabela contasconectadas
        const [contasConectadasRows] = await pool.query(
          "SELECT Conectado FROM contasconectadas WHERE ReferenciaID = ? AND Tipo = 'discord'",
          [referenciaID]
        );
        
        if (contasConectadasRows && contasConectadasRows.length > 0) {
          discordConectado = contasConectadasRows[0].Conectado === 1 ? 1 : 0;
          console.log("Discord encontrado em contasconectadas:", discordConectado);
        } else {
          // Se não estiver na tabela contasconectadas, verificar se há discord_id na tabela utilizadores
          try {
            const [discordRow] = await pool.query(
              "SELECT CASE WHEN discord_id IS NOT NULL AND discord_id != '' THEN 1 ELSE 0 END as Conectado FROM utilizadores WHERE ReferenciaID = ?",
              [referenciaID]
            );
            if (discordRow && discordRow.length > 0 && discordRow[0].Conectado === 1) {
              discordConectado = 1;
              console.log("Discord verificado via discord_id, mas não está em contasconectadas. Inserindo...");
              // Inserir na tabela contasconectadas para sincronizar
              try {
                await pool.query(
                  "INSERT INTO contasconectadas (ReferenciaID, Tipo, Conectado, DataConexao) VALUES (?, 'discord', 1, NOW())",
                  [referenciaID]
                );
                console.log("Discord inserido em contasconectadas para sincronização");
              } catch (insertError) {
                console.log("Erro ao inserir Discord em contasconectadas:", insertError.message);
              }
            }
          } catch (discordIdError) {
            console.log("Coluna discord_id não encontrada:", discordIdError.message);
          }
        }
      } catch (discordError) {
        console.log("Erro ao verificar Discord:", discordError.message);
      }
      
      contas = [...contasRows, { Tipo: 'discord', Conectado: discordConectado }];
      console.log("Contas conectadas:", contas);
    } catch (err) {
      console.error("Erro ao buscar contas conectadas:", err);
      // Retornar valores padrão em caso de erro
      contas = [
        { Tipo: 'email', Conectado: 0 },
        { Tipo: 'telefone', Conectado: 0 },
        { Tipo: 'discord', Conectado: 0 }
      ];
    }

    // Preferências
    const [prefs] = await pool.query(
      "SELECT Tipo, Ativo FROM preferenciasnotificacao WHERE ReferenciaID = ?",
      [referenciaID]
    );

    const u = userRows[0];
    const DIAS_COOLDOWN = 30;
    const lastSenha = u?.UltimaAlteracaoSenha ? new Date(u.UltimaAlteracaoSenha) : null;
    const nextSenha = lastSenha ? new Date(lastSenha.getTime() + DIAS_COOLDOWN * 24 * 60 * 60 * 1000) : null;
    const now = new Date();
    const podeSenha = !nextSenha || now >= nextSenha;
    // Nome: utilizador pode alterar quando quiser (sem cooldown)
    const podeNome = true;
    const perfilId = Number(u?.PerfilId ?? 0);
    let business = null;

    if (perfilId === 4) {
      const [businessRows] = await pool.query(
        `SELECT
            m.organization_id,
            m.role,
            m.status,
            o.nome_empresa,
            o.nif,
            o.vat_number,
            o.website,
            o.setor,
            o.categoria,
            o.pessoa_responsavel,
            o.telefone_comercial,
            o.billing_email,
            o.morada_linha1,
            o.morada_linha2,
            o.cidade,
            o.codigo_postal,
            o.pais,
            o.logo_url,
            o.plano_atual_id
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
          WHERE m.referenciaid = ?
            AND m.status = 'active'
          ORDER BY
            CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
            o.created_at ASC
          LIMIT 1`,
        [referenciaID]
      );

      if (businessRows.length > 0) {
        const org = businessRows[0];
        business = {
          organizationId: org.organization_id,
          role: org.role,
          status: org.status,
          company: {
            nomeEmpresa: org.nome_empresa,
            nif: org.nif,
            vatNumber: org.vat_number,
            website: org.website,
            setor: org.setor,
            categoria: org.categoria,
            pessoaResponsavel: org.pessoa_responsavel,
            telefoneComercial: org.telefone_comercial,
            billingEmail: org.billing_email,
            morada: {
              linha1: org.morada_linha1,
              linha2: org.morada_linha2,
              cidade: org.cidade,
              codigoPostal: org.codigo_postal,
              pais: org.pais
            },
            logoUrl: org.logo_url,
            planoAtualId: org.plano_atual_id
          }
        };
      }
    }

    const response = {
      status: "ok",
      profile: {
        nome: u?.Nome,
        email: u?.Email,
        telefone: u?.Telefone,
        FotoPerfil: u?.FotoPerfil,
        perfilId,
        contas_conectadas: contas,
        preferencias: prefs,
        proxima_alteracao_senha: nextSenha ? nextSenha.toISOString() : null,
        proxima_alteracao_nome: null,
        pode_alterar_senha: podeSenha,
        pode_alterar_nome: podeNome,
        business
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
    const referenciaID = req.user.ReferenciaID;
    const { nome, email, telefone, fotoPerfil, photo_url, data_nascimento } = req.body;

    // Usar photo_url se fornecido, senão usar fotoPerfil
    const foto = photo_url || fotoPerfil;

    const updates = [];
    const values = [];

    if (nome !== undefined) {
      updates.push("Nome = ?");
      values.push(nome);
    }
    if (email !== undefined) {
      updates.push("Email = ?");
      values.push(email);
    }
    if (telefone !== undefined) {
      updates.push("Telefone = ?");
      values.push(telefone);
    }
    if (foto !== undefined) {
      updates.push("FotoPerfil = ?");
      values.push(foto);
    }
    if (data_nascimento !== undefined) {
      updates.push("DataNascimento = ?");
      values.push(data_nascimento || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ 
        status: "error", 
        error: "Nenhum campo fornecido para atualizar" 
      });
    }

    values.push(referenciaID);

    const query = `UPDATE Utilizadores SET ${updates.join(", ")} WHERE ReferenciaID = ?`;
    
    try {
      await pool.query(query, values);
      res.json({ status: "ok", message: "Perfil atualizado com sucesso" });
    } catch (updateErr) {
      // Se alguma coluna opcional não existir, tentar sem ela
      if (updateErr.code === 'ER_BAD_FIELD_ERROR') {
        const msg = (updateErr.message || '');
        const skipField = msg.includes('FotoPerfil') ? 'FotoPerfil' : msg.includes('DataNascimento') ? 'DataNascimento' : null;
        if (skipField) {
          const updatesFiltered = updates.filter(u => !u.includes(skipField));
          if (updatesFiltered.length > 0) {
            const valuesFiltered = values.slice(0, -1).filter((_, i) => !updates[i].includes(skipField));
            valuesFiltered.push(referenciaID);
            await pool.query(`UPDATE Utilizadores SET ${updatesFiltered.join(", ")} WHERE ReferenciaID = ?`, valuesFiltered);
            return res.json({ status: "ok", message: "Perfil atualizado com sucesso" });
          }
        }
      }
      throw updateErr;
    }
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

    await pool.query("UPDATE Utilizadores SET Nome=? WHERE ReferenciaID=?", [
      nome,
      req.user.ReferenciaID,
    ]);

    res.json({ status: "ok", message: "Perfil atualizado com sucesso" });
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

// IMPORTANTE: Esta rota deve vir ANTES de rotas paramétricas genéricas
// mas DEPOIS de rotas específicas como /admins, /profile, etc.
router.put("/admin/:id", verifyToken, async (req, res) => {
  try {
    const targetReferenciaID = req.params.id;
    const currentReferenciaID = req.user.ReferenciaID;
    
    // Verificar se o usuário atual é admin
    const [currentUser] = await pool.query(
      "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
      [currentReferenciaID]
    );
    
    if (currentUser.length === 0 || currentUser[0].PerfilId !== 1) {
      return res.status(403).json({
        status: "error",
        error: "Apenas administradores podem atualizar outros usuários"
      });
    }
    
    // Verificar se o usuário alvo existe
    const [targetUser] = await pool.query(
      "SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ?",
      [targetReferenciaID]
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
      "SELECT ReferenciaID FROM utilizadores WHERE Email = ? AND ReferenciaID != ?",
      [email, targetReferenciaID]
    );
    
    if (emailCheck.length > 0) {
      return res.status(400).json({
        status: "error",
        error: "Este email já está em uso por outro usuário"
      });
    }
    
    // Atualizar usuário
    await pool.query(
      "UPDATE Utilizadores SET Nome = ?, Email = ?, Telefone = ? WHERE ReferenciaID = ?",
      [nome, email, telefone || null, targetReferenciaID]
    );
    
    // Buscar usuário atualizado
    const [updatedUser] = await pool.query(
      `SELECT 
         u.ReferenciaID,
         u.Nome,
         u.Email,
         u.DataRegisto AS DataRegisto,
         p.Nome AS Perfil
       FROM utilizadores u
       LEFT JOIN perfis p ON p.Id = u.PerfilId
       WHERE u.ReferenciaID = ?`,
      [targetReferenciaID]
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
    const referenciaID = req.user.ReferenciaID;
    console.log("[STATS] ReferenciaID extraído do token:", referenciaID);

    // Buscar estatísticas: produtos, notificações, dinheiro_poupado (utilizadores + soma notificações para fallback)
    const [statsRows] = await pool.query(
      `SELECT 
          (SELECT COUNT(*) FROM produtos WHERE ReferenciaID = ?) AS produtos_total,
          (SELECT COUNT(*) FROM notificacoes WHERE ReferenciaID = ?) AS notificacoes_total,
          (SELECT COALESCE(u.dinheiro_poupado,0) FROM utilizadores u WHERE u.ReferenciaID = ? LIMIT 1) AS dinheiro_poupado_user,
          (SELECT COALESCE(SUM(ValorPoupado),0) FROM notificacoes WHERE ReferenciaID = ?) AS dinheiro_poupado_notif`,
      [referenciaID, referenciaID, referenciaID, referenciaID]
    );

    // Usar o maior valor entre utilizadores e soma de notificações (evita mostrar 0 se dados estiverem só em notificações)
    const fromUser = Number(statsRows[0]?.dinheiro_poupado_user) || 0;
    const fromNotif = Number(statsRows[0]?.dinheiro_poupado_notif) || 0;
    const dinheiroPoupadoRaw = Math.max(fromUser, fromNotif);
    if (fromNotif > fromUser) {
      try {
        await pool.query(
          "UPDATE utilizadores SET dinheiro_poupado = ? WHERE ReferenciaID = ?",
          [fromNotif, referenciaID]
        );
      } catch (_) {}
    }

    // Buscar data de registro diretamente
    const [userRows] = await pool.query(
      'SELECT DataRegisto AS "DataRegisto" FROM utilizadores WHERE ReferenciaID = ?',
      [referenciaID]
    );

    console.log("[STATS] ReferenciaID usado:", referenciaID);
    console.log("[STATS] Dados de estatísticas:", { ...statsRows[0], dinheiro_poupado: dinheiroPoupadoRaw });
    console.log("[STATS] userRows completo:", userRows);
    console.log("[STATS] userRows[0]:", userRows[0]);
    console.log("[STATS] DataRegisto raw:", userRows[0]?.DataRegisto);
    console.log("[STATS] Tipo de DataRegisto:", typeof userRows[0]?.DataRegisto);

    // Formatar data de registro
    let membro_desde = "N/A";
    if (userRows && userRows.length > 0 && userRows[0]) {
      const dataRegistoRaw = userRows[0].DataRegisto;
      
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
        console.log("[STATS] DataRegisto é null, undefined ou vazio");
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
        dinheiro_poupado: dinheiroPoupadoRaw,
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

router.get("/admins", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         u.ReferenciaID,
         u.Nome,
         u.Email,
         u.DataRegisto AS DataRegisto,
         u.FotoPerfil,
         u.discord_id,
         p.Nome AS Perfil
       FROM utilizadores u
       LEFT JOIN perfis p ON p.Id = u.PerfilId
       WHERE (p.Nome LIKE 'Admin%' OR u.PerfilId = 1) AND u.Ativo = 1
       ORDER BY COALESCE(u.DataRegisto, NOW()) DESC
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
    const referenciaID = req.user.ReferenciaID;
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

    // Buscar senha atual e última alteração
    const [users] = await pool.query(
      "SELECT SenhaHash, UltimaAlteracaoSenha FROM utilizadores WHERE ReferenciaID = ?",
      [referenciaID]
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

    // Cooldown de 30 dias: verificar última alteração
    const DIAS_COOLDOWN = 30;
    const lastChange = user.UltimaAlteracaoSenha ? new Date(user.UltimaAlteracaoSenha) : null;
    if (lastChange) {
      const nextAllowed = new Date(lastChange.getTime() + DIAS_COOLDOWN * 24 * 60 * 60 * 1000);
      if (new Date() < nextAllowed) {
        return res.status(400).json({
          status: "error",
          error: `Só pode alterar a senha novamente após 30 dias. Próxima alteração permitida: ${nextAllowed.toLocaleDateString("pt-PT")}.`,
          proxima_alteracao: nextAllowed.toISOString()
        });
      }
    }

    // Hash da nova senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha e data da última alteração
    await pool.query(
      "UPDATE Utilizadores SET SenhaHash = ?, UltimaAlteracaoSenha = NOW() WHERE ReferenciaID = ?",
      [hashedPassword, referenciaID]
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
    const referenciaID = req.user.ReferenciaID;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        status: "error", 
        error: "A senha deve ter pelo menos 6 caracteres" 
      });
    }

    // Verificar se já tem senha
    const [users] = await pool.query(
      "SELECT SenhaHash FROM utilizadores WHERE ReferenciaID = ?",
      [referenciaID]
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

    // Atualizar senha e data da última alteração (cooldown 30 dias)
    await pool.query(
      "UPDATE Utilizadores SET SenhaHash = ?, UltimaAlteracaoSenha = NOW() WHERE ReferenciaID = ?",
      [hashedPassword, referenciaID]
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

router.post("/upload-photo", verifyToken, async (req, res) => {
  try {
    console.log("[UPLOAD-PHOTO] Rota chamada");
    const referenciaID = req.user.ReferenciaID;
    const { photo_url } = req.body;
    console.log("[UPLOAD-PHOTO] ReferenciaID:", referenciaID, "Photo URL length:", photo_url?.length || 0);

    if (!photo_url) {
      return res.status(400).json({ 
        status: "error", 
        message: "URL da foto não fornecida" 
      });
    }

    // Verificar se a coluna FotoPerfil existe antes de atualizar
    try {
      await pool.query(
        "UPDATE Utilizadores SET FotoPerfil = ? WHERE ReferenciaID = ?",
        [photo_url, referenciaID]
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

router.delete("/notificacoes/reset", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    await pool.query("DELETE FROM notificacoes WHERE ReferenciaID = ?", [referenciaID]);
    res.json({ status: "ok", message: "Histórico de notificações limpo com sucesso!" });
  } catch (err) {
    console.error("Erro ao resetar notificações:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

router.get("/plano", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID; // vindo do middleware de autenticação

    // Primeiro, verificar se há cancelamento ativo
    const [stripeRows] = await pool.query(`
      SELECT 
        subscription_status,
        plan_name,
        grace_period_end,
        status
      FROM stripe_subscriptions 
      WHERE ReferenciaID = ? AND status = 'canceled' AND grace_period_end > NOW()
    `, [referenciaID]);

    console.log(" [BACKEND] Verificando cancelamentos para ReferenciaID:", referenciaID);
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
      WHERE c.ReferenciaID = ?;
    `, [referenciaID]);

    if (rows.length === 0) {
      return res.json({ status: "erro", message: "Utilizador sem plano ativo." });
    }

    // Verificar se tem customer_id ativo
    const [customerRows] = await pool.query(`
      SELECT customer_id, subscription_id
      FROM stripe_subscriptions 
      WHERE ReferenciaID = ? AND status = 'active'
    `, [referenciaID]);

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

router.post("/plano/alterar", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const { planoId, session_id } = req.body;

    console.log(" Alterando plano para ReferenciaID:", referenciaID, "planoId:", planoId);

    // Validar plano
    const [planoRows] = await pool.query(
      `SELECT ${PLAN_SELECT_FIELDS}
       FROM planos WHERE Id = ?`,
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
         WHERE ReferenciaID = ?`,
        [planoId, plano.LimiteProdutos, referenciaID]
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
       WHERE ReferenciaID = ?`,
      [planoId, plano.LimiteProdutos, session.subscription, referenciaID]
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

router.get("/planos", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;

    // Buscar todos os planos
    const [planos] = await pool.query(
      `SELECT ${PLAN_SELECT_FIELDS}
       FROM planos ORDER BY Preco ASC`
    );

    // Buscar plano atual do usuário
    const [userConfig] = await pool.query(
      "SELECT PlanoAtualId FROM configutilizador WHERE ReferenciaID = ?",
      [referenciaID]
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

router.post("/change-plan", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const { planId } = req.body;

    if (!planId) {
      return res.status(400).json({
        status: "error",
        error: "ID do plano é obrigatório"
      });
    }

    // Verificar se o plano existe
    const [planoRows] = await pool.query(
      `SELECT ${PLAN_SELECT_FIELDS}
       FROM planos WHERE Id = ?`,
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
      "UPDATE configutilizador SET PlanoAtualId = ?, LimiteProdutos = ? WHERE ReferenciaID = ?",
      [planId, plano.LimiteProdutos, referenciaID]
    );

    console.log(` Plano alterado para ${plano.Nome} (ID: ${planId}) para usuário ${referenciaID}`);

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

router.post("/cancel-subscription", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;

    // Buscar configuração atual do usuário
    const [userConfig] = await pool.query(
      `SELECT ${CONFIG_SELECT_FIELDS}
       FROM configutilizador WHERE ReferenciaID = ?`,
      [referenciaID]
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
       WHERE ReferenciaID = ?`,
      [gracePeriodEnd, referenciaID]
    );

    console.log(` Assinatura cancelada para usuário ${referenciaID}. Período de graça até: ${gracePeriodEnd}`);

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

router.get("/2fa/status", verifyToken, async (req, res) => {
  try {
    const status = await getStatus(req.user.ReferenciaID);
    return res.json({ status: "ok", twoFA: status });
  } catch (err) {
    console.error("[USER] Erro ao obter status 2FA:", err);
    return res.status(500).json({ status: "error", error: err.message });
  }
});

router.post("/2fa/setup", verifyToken, async (req, res) => {
  try {
    const { method } = req.body;
    const m = method === "email" ? "email" : "totp";
    const result = await startSetup(req.user.ReferenciaID, m);
    return res.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[USER] Erro ao iniciar setup 2FA:", err);
    return res.status(400).json({ status: "error", error: err.message });
  }
});

router.post("/2fa/verify-setup", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ status: "error", error: "Codigo obrigatorio" });
    const result = await verifyAndEnable(req.user.ReferenciaID, code);
    return res.json({ status: "ok", ...result });
  } catch (err) {
    console.error("[USER] Erro ao ativar 2FA:", err);
    return res.status(400).json({ status: "error", error: err.message });
  }
});

router.post("/2fa/disable", verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ status: "error", error: "Codigo obrigatorio para desativar 2FA" });
    await disable(req.user.ReferenciaID, code);
    return res.json({ status: "ok", enabled: false });
  } catch (err) {
    console.error("[USER] Erro ao desativar 2FA:", err);
    return res.status(400).json({ status: "error", error: err.message });
  }
});

router.post("/2fa/send-email-code", verifyToken, async (req, res) => {
  try {
    await sendEmailCode(req.user.ReferenciaID);
    return res.json({ status: "ok", sent: true });
  } catch (err) {
    console.error("[USER] Erro ao enviar codigo 2FA por email:", err);
    return res.status(500).json({ status: "error", error: err.message });
  }
});

router.post("/deactivate", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const twoFA = await is2FAEnabled(referenciaID);
    if (twoFA) {
      const { code } = req.body || {};
      if (!code) {
        return res.status(403).json({
          status: "error",
          error: "Codigo de verificacao 2FA obrigatorio para desativar a conta",
          requires2FACode: true
        });
      }
      try {
        await verifyCode(referenciaID, code);
      } catch (verifyErr) {
        return res.status(400).json({ status: "error", error: verifyErr.message });
      }
    }

    // Buscar dados do usuário antes de desativar
    const [userRows] = await pool.query(
      "SELECT Nome, Email FROM utilizadores WHERE ReferenciaID = ?",
      [referenciaID]
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
        "UPDATE Utilizadores SET Ativo = 0, DataDesativacao = ? WHERE ReferenciaID = ?",
        [expirationDateStr, referenciaID]
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
            "UPDATE Utilizadores SET Ativo = 0, DataDesativacao = ? WHERE ReferenciaID = ?",
            [expirationDateStr, referenciaID]
          );
          console.log("[USER] Coluna DataDesativacao criada e conta desativada com sucesso");
        } catch (alterError) {
          // Se falhar ao criar (pode já existir), apenas desativar
          console.warn("[USER] Erro ao criar DataDesativacao:", alterError.message);
          await pool.query(
            "UPDATE Utilizadores SET Ativo = 0 WHERE ReferenciaID = ?",
            [referenciaID]
          );
        }
      } else {
        // Outro tipo de erro, apenas desativar
        console.error("[USER] Erro ao desativar conta com data:", error.message);
        await pool.query(
          "UPDATE Utilizadores SET Ativo = 0 WHERE ReferenciaID = ?",
          [referenciaID]
        );
      }
    }

    console.log(`[USER] Conta desativada para usuário ${referenciaID}. Expira em: ${expirationDateStr}`);

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

router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const twoFA = await is2FAEnabled(referenciaID);
    if (twoFA) {
      const { code } = req.body || {};
      if (!code) {
        return res.status(403).json({
          status: "error",
          error: "Codigo de verificacao 2FA obrigatorio para excluir a conta",
          requires2FACode: true
        });
      }
      try {
        await verifyCode(referenciaID, code);
      } catch (verifyErr) {
        return res.status(400).json({ status: "error", error: verifyErr.message });
      }
    }

    // Buscar dados do usuário ANTES de deletar (precisamos do email para enviar confirmação)
    const [userRows] = await pool.query(
      "SELECT Nome, Email FROM utilizadores WHERE ReferenciaID = ?",
      [referenciaID]
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
      await connection.query("DELETE FROM produtos WHERE ReferenciaID = ?", [referenciaID]);

      // 2. Deletar configurações do usuário
      await connection.query("DELETE FROM configutilizador WHERE ReferenciaID = ?", [referenciaID]);

      // 3. Deletar preferências de notificação
      await connection.query("DELETE FROM preferenciasnotificacao WHERE ReferenciaID = ?", [referenciaID]);

      // 4. Deletar contas conectadas
      await connection.query("DELETE FROM contasconectadas WHERE ReferenciaID = ?", [referenciaID]);

      // 5. Deletar assinaturas Stripe relacionadas
      await connection.query("DELETE FROM stripe_subscriptions WHERE ReferenciaID = ?", [referenciaID]);

      // 6. Deletar histórico de notificações
      await connection.query("DELETE FROM notificacoes WHERE ReferenciaID = ?", [referenciaID]);

      // 7. Deletar mensagens de suporte
      await connection.query("DELETE FROM supportmessages WHERE ReferenciaID = ?", [referenciaID]);

      // 8. Deletar tokens de recuperação de senha (já tem CASCADE, mas deletamos explicitamente para garantir)
      await connection.query("DELETE FROM recuperar_senha WHERE ReferenciaID = ?", [referenciaID]);

      // 9. Finalmente, deletar o usuário (isso também deleta automaticamente via CASCADE: recuperar_senha, historicoprecos via produtos)
      await connection.query("DELETE FROM utilizadores WHERE ReferenciaID = ?", [referenciaID]);

      await connection.commit();
      connection.release();

      console.log(`[USER] Conta completamente excluída para usuário ${referenciaID}`);

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
