import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

import { verifyToken } from "../middleware/auth.js";
import { detectStore } from "../utils/storeDetector.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// import { atualizarPrecos } from "../services/atualizarPrecos.js"; // Removido - sem atualização automática
// import { enviarWhatsApp } from "./auth-whatsApp.js"; // WhatsApp desabilitado

const router = express.Router();

// Função auxiliar para salvar preço no histórico - REMOVIDA
// Não há mais atualização automática de preços

//  Adicionar produto (com limite por plano)
router.post("/", verifyToken, async (req, res) => {
    try {
        const { nome, link, data, precoAlvo } = req.body;
        
        console.log(" Dados recebidos:", { nome, link, data, precoAlvo });
        console.log(" Validação:", { 
            nome: !!nome, 
            link: !!link, 
            precoAlvo: !!precoAlvo, 
            isNumber: !isNaN(Number(precoAlvo)),
            isPositive: Number(precoAlvo) > 0
        });

        if (!nome || !link || !precoAlvo || isNaN(Number(precoAlvo)) || Number(precoAlvo) <= 0) {
            console.log(" Validação falhou");
            return res.status(400).json({ 
                status: "error", 
                message: "Preencha os campos obrigatórios (nome, link e preço alvo válido)" 
            });
        }
        
        console.log(" Validação passou");

        // pegar plano e limite do utilizador
        const [configRows] = await pool.query(
            "SELECT PlanoAtualId, LimiteProdutos FROM ConfigUtilizador WHERE UserId=?",
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
        console.log(" Detectando loja para:", link);
        const store = detectStore(link);
        console.log(" Loja detectada:", store);

        // inserir produto com loja detectada (apenas data é opcional)
        console.log(" Inserindo produto no banco...");
        const [result] = await pool.query(
            "INSERT INTO Produtos (UserId, Nome, Link, DataLimite, Loja, PrecoAlvo, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [req.user.id, nome, link, data || null, store.name, Number(precoAlvo)]
        );
        const productId = result.insertId;
        console.log(" Produto inserido com ID:", productId);

        // Executar scraping inicial de forma assíncrona (não bloqueia a resposta)
        const scraperPath = path.join(__dirname, '../../python-scraper/start.py');
        
        // Escapar a URL para segurança (Windows e Linux)
        const escapedLink = link.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        const isWindows = process.platform === 'win32';
        const pythonCmd = isWindows ? 'python' : 'python3';
        const command = `${pythonCmd} "${scraperPath}" --single "${escapedLink}"`;
        
        console.log(" [SCRAPER] Iniciando verificação inicial para:", link);
        exec(command, { cwd: path.join(__dirname, '../../') }, (error, stdout, stderr) => {
            if (error) {
                console.error(" [SCRAPER] Erro na verificação inicial:", error.message);
                return;
            }
            if (stdout) console.log(" [SCRAPER] Output:", stdout);
            if (stderr) console.error(" [SCRAPER] Stderr:", stderr);
        });

        res.json({ 
            status: "ok", 
            message: "Produto adicionado. Verificação inicial iniciada!", 
            produto: {
                Id: productId,
                Nome: nome,
                PrecoAtual: null,
                Loja: store.name
            },
            storeInfo: store
        });
    } catch (err) {
        console.error(" Erro ao adicionar produto:", err);
        console.error(" Detalhes do erro:", {
            message: err.message,
            code: err.code,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage
        });
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
    }
});

//  Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        console.log(" [BACKEND] Buscando produtos para userId:", req.user.id);
        
        // Buscar produtos com data criada e link
        const [produtos] = await pool.query(
            `SELECT Id, Nome, Link, PrecoAtual, PrecoAlvo, DataCriacao, DataLimite, Loja 
             FROM Produtos 
             WHERE UserId = ?`,
            [req.user.id]
        );

        console.log(" [BACKEND] Produtos encontrados:", produtos.length);

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
        
        console.log(" [BACKEND] Produtos mapeados:", produtosMap.length);
        console.log(" [BACKEND] Primeiro produto:", produtosMap[0]);
        
        res.json({ status: "ok", produtos: produtosMap });
    } catch (err) {
        console.error(" [BACKEND] Erro ao listar produtos:", err);
        res.status(500).json({ 
            status: "error", 
            message: "Erro interno do servidor" 
        });
    }
});

//  Histórico de preços de um produto específico
router.get("/:id/historico", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(
            "SELECT Preco, DataRegisto FROM HistoricoPrecos WHERE ProdutoId = ? ORDER BY DataRegisto DESC",
            [id]
        );

        const historico = rows.map(h => ({
            preco: h.Preco,
            data: formatDate(h.DataRegisto)    //  Data formatada
        }));

        res.json({ status: "ok", historico });
    } catch (err) {
        console.error("Erro ao buscar histórico:", err);
        res.status(500).json({ status: "error", message: "Erro ao carregar histórico" });
    }
});

//  Editar produto
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


//  Remover produto
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

//  Refresh manual - REMOVIDO
// Funcionalidade de atualização automática de preços removida

//  Atualizar preço de produto específico - REMOVIDO
// Funcionalidade de atualização automática de preços removida

//  Verificar se há produtos atualizados recentemente
router.get("/sync", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { lastSync } = req.query;
        
        let query = `
            SELECT Id, Nome, PrecoAtual, UpdatedAt 
            FROM produtos 
            WHERE UserId = ?
        `;
        let params = [userId];
        
        // Validar e sanitizar lastSync se fornecido
        if (lastSync) {
            // Validar se lastSync é um número válido
            const timestamp = parseInt(lastSync);
            if (isNaN(timestamp) || timestamp < 0) {
                return res.status(400).json({
                    status: "error",
                    message: "Timestamp inválido fornecido"
                });
            }
            
            // Validar se o timestamp não é muito antigo (máximo 1 ano)
            const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
            if (timestamp < oneYearAgo) {
                return res.status(400).json({
                    status: "error",
                    message: "Timestamp muito antigo"
                });
            }
            
            // Validar se o timestamp não é no futuro
            if (timestamp > Date.now()) {
                return res.status(400).json({
                    status: "error",
                    message: "Timestamp no futuro não é permitido"
                });
            }
            
            query += " AND UpdatedAt > ?";
            params.push(new Date(timestamp));
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
