import express from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ➕ Adicionar produto (com limite por plano)
router.post("/", verifyToken, async (req, res) => {
    try {
        const { nome, link, data } = req.body;

        if (!nome || !link || !data) {
            return res.status(400).json({ error: "Preencha todos os campos" });
        }

        // pegar plano e limite do utilizador
        const [configRows] = await pool.query(
            "SELECT Plano, LimiteProdutos FROM ConfigUtilizador WHERE UserId=?",
            [req.user.id]
        );

        let limite = 5; // default do plano free
        if (configRows.length > 0) {
            limite = configRows[0].LimiteProdutos;
        }

        // contar quantos produtos já cadastrados
        const [countRows] = await pool.query(
            "SELECT COUNT(*) as total FROM Produtos WHERE UserId=?",
            [req.user.id]
        );
        const total = countRows[0].total;

        if (total >= limite) {
            return res.status(403).json({
                error: `Limite de ${limite} produtos atingido no plano atual.`
            });
        }

        // inserir produto
        await pool.query(
            "INSERT INTO Produtos (UserId, Nome, Link, DataLimite) VALUES (?, ?, ?, ?)",
            [req.user.id, nome, link, data]
        );

        res.json({ status: "ok", message: "Produto adicionado com sucesso" });
    } catch (err) {
        console.error("Erro ao adicionar produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});


// 📋 Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT Id, Nome, Link, DataLimite, DataCriacao FROM Produtos WHERE UserId = ? ORDER BY DataCriacao DESC",
            [req.user.id]
        );

        res.json({ status: "ok", produtos: rows });
    } catch (err) {
        console.error("Erro ao listar produtos:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// ✏️ Editar produto
router.put("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, link, data } = req.body;

        const [result] = await pool.query(
            "UPDATE Produtos SET Nome=?, Link=?, DataLimite=? WHERE Id=? AND UserId=?",
            [nome, link, data, id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.json({ status: "ok", message: "Produto atualizado com sucesso" });
    } catch (err) {
        console.error("Erro ao editar produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// ❌ Remover produto
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            "DELETE FROM Produtos WHERE Id=? AND UserId=?",
            [id, req.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }

        res.json({ status: "ok", message: "Produto removido com sucesso" });
    } catch (err) {
        console.error("Erro ao remover produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});


export default router;
