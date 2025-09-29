// backend/routes/contas.js
import express from "express";
import { pool } from "../database/db.js";

const router = express.Router();

// Obter contas conectadas
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const [rows] = await pool.query(
      "SELECT Tipo, Conectado FROM contasconectadas WHERE UserId = ?",
      [userId]
    );

    res.json({ status: "ok", contas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao carregar contas" });
  }
});

// Conectar conta
router.post("/:tipo", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tipo } = req.params;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    await pool.query(
      "INSERT INTO contasconectadas (UserId, Tipo, Conectado, DataConexao) VALUES (?, ?, 1, NOW()) ON DUPLICATE KEY UPDATE Conectado = 1, DataConexao = NOW()",
      [userId, tipo]
    );

    res.json({ status: "ok", message: `Conta ${tipo} conectada` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao conectar conta" });
  }
});

// Desconectar conta
router.delete("/:tipo", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { tipo } = req.params;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    await pool.query(
      "UPDATE contasconectadas SET Conectado = 0 WHERE UserId = ? AND Tipo = ?",
      [userId, tipo]
    );

    res.json({ status: "ok", message: `Conta ${tipo} desconectada` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao desconectar conta" });
  }
});

export default router;
