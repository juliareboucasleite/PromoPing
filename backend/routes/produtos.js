import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";

import { verifyToken } from "../middleware/auth.js";
import { detectStore } from "../utils/storeDetector.js";
import { atualizarPrecos } from "../services/atualizarPrecos.js";
// import { enviarWhatsApp } from "./auth-whatsApp.js"; // WhatsApp desabilitado

const router = express.Router();

// Função auxiliar para salvar preço no histórico
async function salvarPreco(produtoId, preco) {
    await pool.query(
        `INSERT INTO HistoricoPrecos (ProdutoId, Preco, DataRegisto) 
         VALUES (?, ?, NOW())`,
        [produtoId, preco]
    );
}

// ➕ Adicionar produto (com limite por plano)
router.post("/", verifyToken, async (req, res) => {
    try {
        const { nome, link, data, precoAlvo } = req.body;

        if (!nome || !link || !data) {
            return res.status(400).json({ 
                status: "error", 
                message: "Preencha todos os campos obrigatórios" 
            });
        }

        // pegar plano e limite do utilizador
        const [configRows] = await pool.query(
            "SELECT PlanoId, LimiteProdutos FROM ConfigUtilizador WHERE UserId=?",
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
                status: "error",
                message: `Limite de ${limite} produtos atingido no plano atual.`
            });
        }

        // detectar loja pelo link
        const store = detectStore(link);

        // inserir produto com loja detectada
        const [result] = await pool.query(
            "INSERT INTO Produtos (UserId, Nome, Link, DataLimite, Loja, PrecoAlvo) VALUES (?, ?, ?, ?, ?, ?)",
            [req.user.id, nome, link, data, store.name, precoAlvo ?? null]
        );

        res.json({ 
            status: "ok", 
            message: "Produto adicionado com sucesso", 
            produto: {
                Id: result.insertId,
                Nome: nome,
                PrecoAtual: null,
                Loja: store.name
            },
            storeInfo: store
        });
    } catch (err) {
        console.error("Erro ao adicionar produto:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
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
        let historicos = [];
        if (produtos.length > 0) {
            const [historicosResult] = await pool.query(
                `SELECT ProdutoId, Preco, DataRegisto 
                 FROM HistoricoPrecos 
                 WHERE ProdutoId IN (?)`,
                [produtos.map(p => p.Id)]
            );
            historicos = historicosResult;
        }

        // Mapear produtos com formatação e informações da loja
        const produtosMap = produtos.map(p => {
            // Usar o nome da loja da base de dados ou detectar pelo link
            const store = p.Loja ? { name: p.Loja } : detectStore(p.Link);
            const nomeLoja = store.name || "Loja";
            
            return {
                Id: p.Id,
                Nome: p.Nome,
                Link: p.Link,
                PrecoAtual: p.PrecoAtual,
                PrecoAlvo: p.PrecoAlvo,
                DataCriacao: p.DataCriacao,
                DataLimite: p.DataLimite,
                Loja: nomeLoja,
                storeInfo: store,
                Historico: historicos
                    .filter(h => h.ProdutoId === p.Id)
                    .map(h => ({
                        Preco: h.Preco,
                        Data: h.DataRegisto
                    }))
            };
        });
        
        res.json({ status: "ok", produtos: produtosMap });
    } catch (err) {
        console.error("Erro ao listar produtos:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
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
            return res.status(404).json({ 
                status: "error", 
                message: "Produto não encontrado" 
            });
        }

        res.json({ status: "ok", message: "Produto atualizado com sucesso" });
    } catch (err) {
        console.error("Erro ao editar produto:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
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
            return res.status(404).json({ 
                status: "error", 
                message: "Produto não encontrado" 
            });
        }

        res.json({ status: "ok", message: "Produto removido com sucesso" });
    } catch (err) {
        console.error("Erro ao remover produto:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
    }
});

// 🔄 Refresh manual
router.post("/refresh", verifyToken, async (req, res) => {
  try {
    const result = await atualizarPrecos(req.user.id);

    if (result.error) {
      return res.status(403).json({ 
        status: "error", 
        message: result.error 
      });
    }

    res.json(result);
  } catch (err) {
    console.error("Erro no refresh manual:", err);
    res.status(500).json({ 
      status: "error", 
      message: "Erro interno do servidor" 
    });
  }
});

// 🔄 Atualizar preço de produto específico
router.post("/:id/refresh", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        console.log(`🔄 Atualizando produto específico ${id} para usuário ${userId}`);
        
        // Verificar se o produto pertence ao usuário e buscar plano
        const [produto] = await pool.query(
            `SELECT p.*, c.PlanoId, pl.VerificacaoIntervalo, pl.Nome as PlanoNome
             FROM Produtos p
             JOIN ConfigUtilizador c ON c.UserId = p.UserId
             JOIN Planos pl ON pl.Id = c.PlanoId
             WHERE p.Id = ? AND p.UserId = ?`,
            [id, userId]
        );
        
        if (produto.length === 0) {
            return res.status(404).json({ 
                status: "error", 
                message: "Produto não encontrado" 
            });
        }
        
        const p = produto[0];
        
        // Verificar intervalo de verificação para produto específico
        const ultimaAtualizacao = p.UpdatedAt || new Date(0);
        const agora = new Date();
        const diffHoras = (agora - ultimaAtualizacao) / (1000 * 60 * 60);
        
        // Checar regra de refresh individual
        if (p.VerificacaoIntervalo > 0 && diffHoras < p.VerificacaoIntervalo) {
            return res.status(403).json({
                status: "error",
                message: `Produto só pode ser atualizado a cada ${p.VerificacaoIntervalo}h (faltam ${(p.VerificacaoIntervalo - diffHoras).toFixed(1)}h)`
            });
        }
        
        // Função temporária de scraping - substituir pela implementação real
        async function fetchPreco(link) {
            // TODO: Implementar scraping real ou integração com API
            // Por enquanto retorna valor aleatório para testes
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
        
        // WhatsApp desabilitado
        // try {
        //     const [userData] = await pool.query(
        //         "SELECT Telefone FROM Utilizadores WHERE Id = ?",
        //         [userId]
        //     );
        //     
        //     if (userData.length > 0 && userData[0].Telefone) {
        //         await enviarWhatsApp(userData[0].Telefone, `${p.Nome}: €${novoPreco}`);
        //         console.log(`WhatsApp enviado para ${userData[0].Telefone}`);
        //     }
        // } catch (whatsappError) {
        //     console.error("Erro ao enviar WhatsApp:", whatsappError);
        //     // Não falha a operação se o WhatsApp der erro
        // }
        
        console.log(`✅ Produto ${p.Nome} atualizado para €${novoPreco} (Plano: ${p.PlanoNome})`);
        
        res.json({ 
            status: "ok", 
            message: "Preço atualizado com sucesso",
            produto: {
                id: p.Id,
                nome: p.Nome,
                novoPreco: novoPreco
            },
            plano: p.PlanoNome
        });
    } catch (err) {
        console.error("Erro no refresh individual:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro ao atualizar preço do produto" 
        });
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
        res.status(500).json({ 
            status: "error", 
            message: "Erro ao verificar atualizações" 
        });
    }
});

export default router;
