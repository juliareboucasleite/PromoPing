// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET perfil do utilizador logado (rota antiga mantida para compatibilidade)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT Id, Nome, Email, DataCriacao FROM Utilizadores WHERE Id=?",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Utilizador não encontrado" });
    }
    res.json({ status: "ok", user: rows[0] });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ error: "Erro interno no servidor" });
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

    // Contar produtos
    const [produtosCount] = await pool.query(
      "SELECT COUNT(*) as total FROM Produtos WHERE UserId = ?",
      [userId]
    );

    // Contar notificações
    const [notificacoesCount] = await pool.query(
      "SELECT COUNT(*) as total FROM Notificacoes WHERE UserId = ?",
      [userId]
    );

    // Somar dinheiro poupado (assumindo que há um campo ValorPoupado na tabela Notificacoes)
    const [dinheiroPoupado] = await pool.query(
      "SELECT COALESCE(SUM(ValorPoupado), 0) as total FROM Notificacoes WHERE UserId = ? AND ValorPoupado IS NOT NULL",
      [userId]
    );

    res.json({
      status: "ok",
      stats: {
        produtos_total: produtosCount[0]?.total || 0,
        notificacoes_total: notificacoesCount[0]?.total || 0,
        dinheiro_poupado: dinheiroPoupado[0]?.total || 0
      }
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
