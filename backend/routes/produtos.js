import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";

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

        // 2. Rodar scraper inicial com sistema inteligente
        try {
            const { scrapeProduct } = await import('../scraper/index.js');
            const info = await scrapeProduct(link);
            
            if (info?.success && info?.price != null) {
                // Atualiza PrecoAtual no produto
                await pool.query(
                    "UPDATE Produtos SET PrecoAtual=? WHERE Id=?",
                    [info.price, result.insertId]
                );

                // Cria histórico inicial
                await pool.query(
                    "INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) VALUES (?, ?, NOW())",
                    [result.insertId, info.price]
                );
                
                console.log(`✅ Scraper inicial executado para ${nome}: €${info.price} (${info.loja} - ${info.method})`);
            } else {
                console.warn(`⚠️ Scraper inicial falhou para ${nome} - preço não encontrado`);
            }
        } catch (e) {
            console.warn('❌ Erro no scraper inicial:', e.message);
        }

        // Buscar dados finais do produto para resposta
        const [produtoFinal] = await pool.query(
            "SELECT Id, Nome, PrecoAtual, Loja FROM Produtos WHERE Id = ?",
            [result.insertId]
        );

        res.json({ 
            status: "ok", 
            message: "Produto adicionado com sucesso", 
            produto: produtoFinal[0],
            loja: store.name 
        });
    } catch (err) {
        console.error("Erro ao adicionar produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 📋 Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        // Buscar produtos com data criada
        const [produtos] = await pool.query(
            `SELECT Id, Nome, Marca, PrecoAtual, PrecoAnterior, PrecoAlvo, DataCriacao 
             FROM Produtos 
             WHERE UserId = ?`,
            [req.user.id]
        );

        // Buscar histórico de preços separado
        const [historicos] = await pool.query(
            `SELECT ProdutoId, Preco, DataRegisto 
             FROM HistoricoPrecos 
             WHERE ProdutoId IN (?)`,
            [produtos.map(p => p.Id)]
        );

        // Mapear produtos com formatação
        const produtosMap = produtos.map(p => ({
            id: p.Id,
            nome: p.Nome,                // 🔹 corresponde ao "nome" esperado
            marca: p.Marca,              // 🔹 corresponde ao "marca" esperado
            preco_atual: p.PrecoAtual,
            preco_anterior: p.PrecoAnterior,
            preco_alvo: p.PrecoAlvo,
            criado_em: formatDate(p.DataCriacao),     // 🔹 Data formatada
            historico: historicos
                .filter(h => h.ProdutoId === p.Id)
                .map(h => ({
                    preco: h.Preco,
                    data: formatDate(h.DataRegisto)    // 🔹 Data formatada
                }))
        }));

        res.json({ status: "ok", produtos: produtosMap });
    } catch (err) {
        console.error("Erro ao listar produtos:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 📊 Histórico de preços de um produto específico
router.get("/:id/historico", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            "SELECT Preco, DataRegisto FROM HistoricoPrecos WHERE ProdutoId = ? ORDER BY DataRegisto DESC",
            [id]
        );

        const historico = rows.map(h => ({
            preco: h.Preco,
            data: formatDate(h.DataRegisto)    // 🔹 Data formatada
        }));

        res.json({ status: "ok", historico });
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        res.status(500).json({ status: "error", message: "Erro ao carregar histórico" });
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
