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

    // Contas conectadas
    const [contas] = await pool.query(
      "SELECT 'google' as Tipo, GoogleId IS NOT NULL as Conectado FROM Utilizadores WHERE Id = ? " +
      "UNION SELECT 'discord', DiscordId IS NOT NULL FROM Utilizadores WHERE Id = ? " +
      "UNION SELECT 'telefone', Telefone IS NOT NULL FROM Utilizadores WHERE Id = ?",
      [userId, userId, userId]
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

export default router;
