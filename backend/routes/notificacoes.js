// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET notificações do utilizador logado
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    
    const [rows] = await pool.query(
      "SELECT Id, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio FROM Notificacoes WHERE UserId=? ORDER BY DataEnvio DESC LIMIT ?",
      [userId, limit]
    );
    
    res.json({ 
      status: "ok", 
      notificacoes: rows.map(row => ({
        id: row.Id,
        produto_id: row.ProdutoId,
        tipo: row.Tipo,
        mensagem: row.Mensagem,
        enviada: row.Enviada === 1,
        data_envio: row.DataEnvio
      }))
    });
  } catch (err) {
    console.error("Erro ao carregar notificações:", err);
    res.status(500).json({ status: "error", error: "Erro interno no servidor" });
  }
});

// Marcar uma notificação como lida
router.put("/:id/lida", verifyToken, async (req, res) => {
  try {
    await pool.query("UPDATE Notificacoes SET Enviada=1 WHERE Id=? AND UserId=?", [
      req.params.id,
      req.user.id,
    ]);
    res.json({ status: "ok", message: "Notificação marcada como lida" });
  } catch (err) {
    console.error("Erro ao atualizar notificação:", err);
    res.status(500).json({ status: "error", error: "Erro interno no servidor" });
  }
});

export default router;
