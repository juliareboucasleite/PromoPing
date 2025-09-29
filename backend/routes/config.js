// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * ===============================
 * PERFIL DO UTILIZADOR
 * ===============================
 */

// GET perfil
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT Nome, Email, Telefone FROM ConfigUtilizador WHERE UserId=?",
      [req.user.id]
    );
    res.json({ status: "ok", profile: rows[0] || {} });
  } catch (err) {
    console.error("Erro ao buscar perfil:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

// PUT perfil
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { nome, email, telefone } = req.body;
    await pool.query(
      `INSERT INTO ConfigUtilizador (UserId, Nome, Email, Telefone) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE Nome=VALUES(Nome), Email=VALUES(Email), Telefone=VALUES(Telefone)`,
      [req.user.id, nome, email, telefone]
    );
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao salvar perfil:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

/**
 * ===============================
 * PREFERÊNCIAS DE NOTIFICAÇÃO
 * ===============================
 */

// GET preferências
router.get("/preferences", verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT Tipo, Ativo FROM PreferenciasNotificacao WHERE UserId=?",
      [req.user.id]
    );
    res.json({ status: "ok", preferencias: rows });
  } catch (err) {
    console.error("Erro ao buscar preferências:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

// PUT preferências
router.put("/preferences", verifyToken, async (req, res) => {
  try {
    const { preferences } = req.body; // [{tipo, ativo}]
    if (!Array.isArray(preferences)) {
      return res.status(400).json({ status: "error", error: "Formato inválido" });
    }

    for (const p of preferences) {
      await pool.query(
        `INSERT INTO PreferenciasNotificacao (UserId, Tipo, Ativo) 
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Ativo=VALUES(Ativo)`,
        [req.user.id, p.tipo, p.ativo]
      );
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao salvar preferências:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

/**
 * ===============================
 * ESTATÍSTICAS DO UTILIZADOR
 * ===============================
 */
router.get("/stats", verifyToken, async (req, res) => {
  try {
    const [[{ totalProdutos }]] = await pool.query(
      "SELECT COUNT(*) AS totalProdutos FROM Produtos WHERE UserId=?",
      [req.user.id]
    );

    const [[{ totalNotificacoes }]] = await pool.query(
      "SELECT COUNT(*) AS totalNotificacoes FROM Notificacoes WHERE UserId=?",
      [req.user.id]
    );

    const [[{ membroDesde }]] = await pool.query(
      "SELECT MIN(DataRegisto) AS membroDesde FROM Utilizadores WHERE Id=?",
      [req.user.id]
    );

    res.json({
      status: "ok",
      stats: {
        produtos_monitorizados: totalProdutos,
        notificacoes_enviadas: totalNotificacoes,
        dinheiro_poupado: 0, // implementar depois
        membro_desde: membroDesde
          ? new Date(membroDesde).toLocaleDateString("pt-PT", {
              year: "numeric",
              month: "short",
            })
          : "N/A",
      },
    });
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ status: "error", error: "Erro no servidor" });
  }
});

export default router;
