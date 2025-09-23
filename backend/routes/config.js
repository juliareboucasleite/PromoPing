import express from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ➕ Criar ou atualizar configuração do utilizador
router.post("/", verifyToken, async (req, res) => {
    try {
        const { plano, canal } = req.body;

        await pool.query(`
            INSERT INTO ConfigUtilizador (UserId, Plano, CanalPreferido)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE Plano=?, CanalPreferido=?`,
            [req.user.id, plano, canal, plano, canal]
        );

        res.json({ status: "ok", message: "Configuração atualizada" });
    } catch (err) {
        console.error("Erro ao salvar config:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 📋 Obter configuração
router.get("/", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM ConfigUtilizador WHERE UserId=?",
            [req.user.id]
        );

        if (rows.length === 0) {
            return res.json({ status: "ok", config: { Plano: "free", CanalPreferido: "whatsapp", LimiteProdutos: 5 } });
        }

        res.json({ status: "ok", config: rows[0] });
    } catch (err) {
        console.error("Erro ao buscar config:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

export default router;
