import express from "express";
import { pool } from "../db.js";
import { verifyToken } from "../middleware/auth.js";
import { detectStore } from "../services/scrapers/index.js";

const router = express.Router();

// ➕ Adicionar produto (com limite por plano)
router.post("/", verifyToken, async (req, res) => {
    try {
        const { nome, link, data, precoAlvo } = req.body;

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

        // detectar loja pela URL
        const store = detectStore(link);

        // inserir produto
        const [result] = await pool.query(
            "INSERT INTO Produtos (UserId, Nome, Link, DataLimite, Loja, PrecoAlvo) VALUES (?, ?, ?, ?, ?, ?)",
            [req.user.id, nome, link, data, store.name, precoAlvo ?? null]
        );

        // cria registro inicial no histórico com preço se disponível via scraper leve (opcional)
        try {
            // Não bloqueante: tentar obter preço atual para iniciar histórico
            const { scrapeProductInfo } = await import('../services/scrapers/index.js');
            const info = await scrapeProductInfo(link);
            if (info?.preco != null) {
                await pool.query("INSERT INTO HistoricoPrecos (ProdutoId, Preco) VALUES (?, ?)",[result.insertId, info.preco]);
            }
        } catch (e) {
            console.warn('Não foi possível iniciar histórico de preço:', e.message);
        }

        res.json({ status: "ok", message: "Produto adicionado com sucesso", loja: store.name });
    } catch (err) {
        console.error("Erro ao adicionar produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});


// 📋 Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT Id, Nome, Link, Loja, PrecoAlvo, DataLimite, DataCriacao FROM Produtos WHERE UserId = ? ORDER BY DataCriacao DESC",
            [req.user.id]
        );

        // anexar histórico curto e preços atuais/anteriores
        const produtos = [];
        for (const p of rows) {
            let [hist] = await pool.query(
                "SELECT Preco, DataRegistro FROM HistoricoPrecos WHERE ProdutoId=? ORDER BY DataRegistro DESC LIMIT 10",
                [p.Id]
            );
            // Se não tiver histórico, capturar primeiro preço agora
            if (hist.length === 0) {
                try {
                    const { scrapeProductInfo } = await import('../services/scrapers/index.js');
                    const info = await scrapeProductInfo(p.Link);
                    if (info?.preco != null) {
                        await pool.query("INSERT INTO HistoricoPrecos (ProdutoId, Preco) VALUES (?, ?)", [p.Id, info.preco]);
                        const [h2] = await pool.query(
                            "SELECT Preco, DataRegistro FROM HistoricoPrecos WHERE ProdutoId=? ORDER BY DataRegistro DESC LIMIT 10",
                            [p.Id]
                        );
                        hist = h2;
                    }
                } catch (e) {
                    console.warn('Falha ao iniciar histórico para produto', p.Id, e.message);
                }
            }
            const precoAtual = hist[0]?.Preco ?? null;
            const precoAnterior = hist[1]?.Preco ?? null;
            produtos.push({ ...p, PrecoAtual: precoAtual, PrecoAnterior: precoAnterior, Historico: hist });
        }

        res.json({ status: "ok", produtos });
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
        const nomeVal = nome ?? null;
        const linkVal = link ?? null;
        const dataVal = data ?? null;

        const [result] = await pool.query(
            "UPDATE Produtos SET Nome=COALESCE(?, Nome), Link=COALESCE(?, Link), DataLimite=COALESCE(?, DataLimite) WHERE Id=? AND UserId=?",
            [nomeVal, linkVal, dataVal, id, req.user.id]
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
