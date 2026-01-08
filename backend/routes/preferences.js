// @ts-nocheck
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// GET preferências do utilizador
router.get("/", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    
    const [prefs] = await pool.query(
      "SELECT Tipo, Ativo FROM PreferenciasNotificacao WHERE ReferenciaID = ?",
      [referenciaID]
    );

    res.json({
      status: "ok",
      preferences: prefs
    });
  } catch (err) {
    console.error("Erro ao buscar preferências:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// PUT atualizar preferências
router.put("/", verifyToken, async (req, res) => {
  try {
    const referenciaID = req.user.ReferenciaID;
    const { preferences } = req.body; // [{ tipo, ativo }]

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ 
        status: "error", 
        error: "Preferências devem ser um array" 
      });
    }

    for (const pref of preferences) {
      if (!pref.tipo || typeof pref.ativo !== 'boolean') {
        return res.status(400).json({ 
          status: "error", 
          error: "Cada preferência deve ter 'tipo' e 'ativo' (boolean)" 
        });
      }

      await pool.query(
        `INSERT INTO PreferenciasNotificacao (ReferenciaID, Tipo, Ativo)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE Ativo=VALUES(Ativo)`,
        [referenciaID, pref.tipo, pref.ativo ? 1 : 0]
      );
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao atualizar preferências:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

export default router;
