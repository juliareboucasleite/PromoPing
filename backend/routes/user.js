import express from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ================== GET CONFIG ==================
router.get("/config", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT Plano, CanalPreferido, LimiteProdutos, HistoricoAtivo FROM ConfigUtilizador WHERE UserId = ?",
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Configuração não encontrada" });
        }

        res.json({ status: "ok", config: rows[0] });
    } catch (err) {
        console.error("Erro no GET /config:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

// ================== UPDATE CONFIG ==================
router.put("/config", verifyToken, async (req, res) => {
    try {
        const { Plano, CanalPreferido, HistoricoAtivo } = req.body;

        // só atualiza os campos enviados
        const [result] = await pool.query(
            "UPDATE ConfigUtilizador SET Plano = ?, CanalPreferido = ?, HistoricoAtivo = ? WHERE UserId = ?",
            [Plano || "free", CanalPreferido || "whatsapp", HistoricoAtivo ?? 1, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Configuração não encontrada" });
        }

        res.json({ status: "ok", message: "Configuração atualizada com sucesso" });
    } catch (err) {
        console.error("Erro no PUT /config:", err);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

export default router;
