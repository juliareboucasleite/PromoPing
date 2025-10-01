import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";

import { verifyToken } from "../middleware/auth.js";
import { detectStore } from "../utils/storeDetector.js";
import { atualizarPrecos } from "../services/atualizarPrecos.js";

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

        // detectar loja pelo link
        const store = detectStore(link);

        // inserir produto com loja detectada
        const [result] = await pool.query(
            "INSERT INTO Produtos (UserId, Nome, Link, DataLimite, Loja, PrecoAlvo) VALUES (?, ?, ?, ?, ?, ?)",
            [req.user.id, nome, link, data, store.name, precoAlvo ?? null]
        );

        // Buscar dados finais do produto para resposta
        const [produtoFinal] = await pool.query(
            "SELECT Id, Nome, PrecoAtual, Loja FROM Produtos WHERE Id = ?",
            [result.insertId]
        );

        res.json({ 
            status: "ok", 
            message: "Produto adicionado com sucesso", 
            produto: produtoFinal[0],
            loja: store.name,
            storeInfo: store
        });
    } catch (err) {
        console.error("Erro ao adicionar produto:", err);
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// 📋 Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        // Buscar produtos com data criada e link
        const [produtos] = await pool.query(
            `SELECT Id, Nome, Link, PrecoAtual, PrecoAlvo, DataCriacao, DataLimite, Loja 
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

        // Debug: verificar dados brutos da base de dados
        console.log("Produtos da base de dados:", produtos);
        if (produtos.length > 0) {
            console.log("Primeiro produto da BD:", produtos[0]);
            console.log("PrecoAlvo:", produtos[0].PrecoAlvo);
            console.log("DataCriacao:", produtos[0].DataCriacao);
            console.log("Loja:", produtos[0].Loja);
        }

        // Mapear produtos com formatação e informações da loja
        const produtosMap = produtos.map(p => {
            const store = detectStore(p.Link);
            console.log("Detectando loja para link:", p.Link);
            console.log("Store detectada:", store);
            
            // Forçar o nome da loja baseado no link
            let nomeLoja = "Loja";
            if (p.Link) {
                if (p.Link.includes('fnac')) nomeLoja = "FNAC";
                else if (p.Link.includes('worten')) nomeLoja = "Worten";
                else if (p.Link.includes('ikea')) nomeLoja = "IKEA";
                else if (p.Link.includes('pcdiga')) nomeLoja = "PCDiga";
                else if (p.Link.includes('globaldata')) nomeLoja = "GlobalData";
                else if (p.Link.includes('radiopopular')) nomeLoja = "Radio Popular";
                else if (p.Link.includes('mediamarkt')) nomeLoja = "MediaMarkt";
                else if (p.Link.includes('leroymerlin')) nomeLoja = "Leroy Merlin";
                else if (p.Link.includes('zara')) nomeLoja = "Zara";
                else if (p.Link.includes('hm')) nomeLoja = "H&M";
                else if (p.Link.includes('amazon')) nomeLoja = "Amazon";
            }
            
            console.log("Nome da loja detectado:", nomeLoja);
            
            const produtoMapeado = {
                Id: p.Id,
                Nome: p.Nome,
                Link: p.Link,
                PrecoAtual: p.PrecoAtual,
                PrecoAlvo: p.PrecoAlvo,
                DataCriacao: p.DataCriacao,
                DataLimite: p.DataLimite,
                Loja: nomeLoja, // Nome da loja detectado pelo link
                storeInfo: store,
                Historico: historicos
                    .filter(h => h.ProdutoId === p.Id)
                    .map(h => ({
                        Preco: h.Preco,
                        Data: h.DataRegisto
                    }))
            };
            
            // Debug: verificar produto mapeado
            console.log("Produto mapeado:", produtoMapeado);
            console.log("PrecoAlvo mapeado:", produtoMapeado.PrecoAlvo);
            console.log("DataCriacao mapeada:", produtoMapeado.DataCriacao);
            console.log("Loja mapeada:", produtoMapeado.Loja);
            console.log("Loja da BD:", p.Loja);
            console.log("Store name:", store.name);
            
            return produtoMapeado;
        });

        console.log("Enviando produtos para frontend:");
        console.log("Primeiro produto a ser enviado:", produtosMap[0]);
        console.log("Campo Loja do primeiro produto:", produtosMap[0]?.Loja);
        
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

// 🔄 Atualizar preços manualmente (todos)
router.post("/refresh", verifyToken, async (req, res) => {
    try {
        console.log(`🔄 Iniciando atualização manual de preços para usuário ${req.user.id}`);
        const result = await atualizarPrecos(req.user.id); // só produtos do user
        res.json({ 
            status: "ok", 
            message: "Preços atualizados com sucesso",
            produtosAtualizados: result.produtosAtualizados
        });
    } catch (err) {
        console.error("Erro no refresh:", err);
        res.status(500).json({ error: "Erro ao atualizar preços" });
    }
});

// 🔄 Atualizar preço de produto específico
router.post("/:id/refresh", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log(`🔄 Atualizando produto específico ${id} para usuário ${userId}`);
        
        // Verificar se o produto pertence ao usuário
        const [produto] = await pool.query(
            "SELECT * FROM Produtos WHERE Id = ? AND UserId = ?",
            [id, userId]
        );
        
        if (produto.length === 0) {
            return res.status(404).json({ error: "Produto não encontrado" });
        }
        
        const p = produto[0];
        
        // Função fake de scraping -> trocar pelo real
        async function fetchPreco(link) {
            // TODO: aqui vem scraping/API real
            // por enquanto devolve número aleatório pra testar
            return (Math.random() * 1000).toFixed(2);
        }
        
        const novoPreco = await fetchPreco(p.Link);
        
        // Atualiza PrecoAtual no produto
        await pool.query(
            "UPDATE Produtos SET PrecoAtual = ?, UpdatedAt = NOW() WHERE Id = ?",
            [novoPreco, p.Id]
        );
        
        // Salva no histórico
        await salvarPreco(p.Id, novoPreco);
        
        console.log(`✅ Produto ${p.Nome} atualizado para €${novoPreco}`);
        
        res.json({ 
            status: "ok", 
            message: "Preço atualizado com sucesso",
            produto: {
                id: p.Id,
                nome: p.Nome,
                novoPreco: novoPreco
            }
        });
    } catch (err) {
        console.error("Erro no refresh individual:", err);
        res.status(500).json({ error: "Erro ao atualizar preço do produto" });
    }
});

// 📊 Verificar se há produtos atualizados recentemente
router.get("/sync", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { lastSync } = req.query;
        
        let query = `
            SELECT Id, Nome, PrecoAtual, UpdatedAt 
            FROM Produtos 
            WHERE UserId = ?
        `;
        let params = [userId];
        
        // Se foi fornecido um timestamp, buscar apenas produtos atualizados depois dele
        if (lastSync) {
            query += " AND UpdatedAt > ?";
            params.push(new Date(parseInt(lastSync)));
        }
        
        const [produtos] = await pool.query(query, params);
        
        res.json({
            status: "ok",
            produtos: produtos,
            timestamp: Date.now()
        });
    } catch (err) {
        console.error("Erro ao verificar sincronização:", err);
        res.status(500).json({ error: "Erro ao verificar atualizações" });
    }
});

export default router;
