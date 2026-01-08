// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET notificações do utilizador logado
router.get("/", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    
    const [rows] = await pool.query(
      "SELECT Tipo, Mensagem, DataEnvio, ValorPoupado FROM notificacoes WHERE ReferenciaID = ? ORDER BY DataEnvio DESC",
      [referenciaID]
    );
    
    res.json({ status: "ok", notificacoes: rows });
  } catch (err) {
    console.error("Erro ao carregar notificações:", err);
    res.status(500).json({ status: "error", error: "Erro interno no servidor" });
  }
});

// Marcar uma notificação como lida
router.put("/:id/lida", verifyToken, async (req, res) => {
  try {
    await pool.query("UPDATE Notificacoes SET Enviada=1 WHERE Id=? AND ReferenciaID=?", [
      req.params.id,
      req.user.ReferenciaID,
    ]);
    res.json({ status: "ok", message: "Notificação marcada como lida" });
  } catch (err) {
    console.error("Erro ao atualizar notificação:", err);
    res.status(500).json({ status: "error", error: "Erro interno no servidor" });
  }
});

export default router;
