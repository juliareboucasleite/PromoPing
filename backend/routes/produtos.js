import express from "express";
import { pool } from "../database/db.js";
import { formatDate } from "../utils/format.js";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { verifyToken } from "../middleware/auth.js";
import { detectStore } from "../utils/storeDetector.js";
import { resolveProductSearchIntent } from "../services/productSearchAssistant.service.js";

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

const isWindows = process.platform === 'win32';
const venvPython = path.join(
    __dirname,
    '../../.venv',
    isWindows ? 'Scripts' : 'bin',
    isWindows ? 'python.exe' : 'python'
);
const pythonExec = fs.existsSync(venvPython)
    ? `"${venvPython}"`
    : (isWindows ? 'python' : 'python3');

/** Aceita apenas URLs com esquema http ou https (bloqueia javascript:, data:, etc.). */
function isAllowedProductUrl(url) {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

function normalizeProductName(nome) {
  return String(nome || "").trim();
}

function fitProductNameToColumn(nome, maxLength = 150) {
  const normalized = normalizeProductName(nome);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength).trim();
}

//! Não há mais atualização automática de preços
//  Adicionar produto (com limite por plano)
router.post("/", verifyToken, async (req, res) => {
    try {
        const { nome, link, data, precoAlvo } = req.body;
        const safeNome = fitProductNameToColumn(nome);
        const normalizedLink = typeof link === "string" ? link.trim() : "";
        
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
        if (!safeNome) {
            return res.status(400).json({
                status: "error",
                message: "O nome do produto é obrigatório."
            });
        }
        if (!isAllowedProductUrl(normalizedLink)) {
            return res.status(400).json({
                status: "error",
                message: "O link do produto deve ser um URL válido (http ou https)."
            });
        }
        
        console.log(" Validação passou");

        // pegar plano e limite do utilizador
        const [configRows] = await pool.query(
            "SELECT PlanoAtualId, LimiteProdutos FROM configutilizador WHERE ReferenciaID=?",
            [req.user.ReferenciaID]
        );

        let limite = 5; // default do plano free
        if (configRows.length > 0) {
            limite = configRows[0].LimiteProdutos;
        }

        // contar quantos produtos já cadastrados
        const [countRows] = await pool.query(
            "SELECT COUNT(*) as total FROM produtos WHERE ReferenciaID=?",
            [req.user.ReferenciaID]
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

        // Buscar ou criar loja na tabela lojas para obter LojaId
        let lojaId = null;
        if (store && store.domain) {
            try {
                // Buscar loja pelo domínio (usando nomes corretos das colunas: PascalCase)
                const [lojaRows] = await pool.query(
                    "SELECT Id FROM lojas WHERE Dominio = ? LIMIT 1",
                    [store.domain]
                );
                
                if (lojaRows.length > 0) {
                    lojaId = lojaRows[0].Id;
                    console.log(" Loja encontrada na base de dados, ID:", lojaId);
                } else {
                    // Se não encontrar, tentar buscar pelo nome
                    const [lojaNomeRows] = await pool.query(
                        "SELECT Id FROM lojas WHERE Nome = ? LIMIT 1",
                        [store.name]
                    );
                    
                    if (lojaNomeRows.length > 0) {
                        lojaId = lojaNomeRows[0].Id;
                        console.log(" Loja encontrada pelo nome, ID:", lojaId);
                    } else {
                        console.log(" Loja não encontrada na base de dados, usando NULL");
                    }
                }
            } catch (lojaError) {
                console.error(" Erro ao buscar loja:", lojaError.message);
                // Continuar com lojaId = null se houver erro
            }
        }

        // inserir produto com loja detectada (apenas data é opcional)
        console.log(" Inserindo produto no banco...");
        const [result] = await pool.query(
            "INSERT INTO produtos (ReferenciaID, Nome, Link, DataLimite, LojaId, PrecoAlvo, UpdatedAt) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [req.user.ReferenciaID, nome, link, data || null, lojaId, Number(precoAlvo)]
        );
        const productId = result.insertId;
        console.log(" Produto inserido com ID:", productId);

        // Executar scraping inicial de forma assíncrona (não bloqueia a resposta)
        const scraperPath = path.join(__dirname, '../../python-scraper/start.py');
        
        // Escapar a URL para segurança (Windows e Linux)
        const escapedLink = link.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        const command = `${pythonExec} "${scraperPath}" --single "${escapedLink}"`;
        
        console.log(" [SCRAPER] Iniciando verificação inicial para:", link);
        exec(command, { cwd: path.join(__dirname, '../../') }, (error, stdout, stderr) => {
            if (error) {
                console.error(" [SCRAPER] Erro na verificação inicial:", error.message);
                return;
            }
            if (stdout) console.log(" [SCRAPER] Output:", stdout);
            if (stderr) console.error(" [SCRAPER] Stderr:", stderr);
        });

        // Executar comparação de produtos em background (opcional, não bloqueia resposta)
        // Pode ser acionado posteriormente via rota /produtos/:id/compare
        const comparisonResults = null; // Será preenchido se usuário solicitar
        
        res.json({ 
            status: "ok", 
            message: "Produto adicionado. Verificação inicial iniciada!", 
            produto: {
                Id: productId,
                Nome: nome,
                PrecoAtual: null,
                Loja: store.name
            },
            storeInfo: store,
            comparisonAvailable: true // Indica que comparação está disponível
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

// Cache em memória para resultados de pesquisa (TTL 30 min)
const searchCache = new Map();
const searchIntentCache = new Map();
const SEARCH_CACHE_TTL_MS = 30 * 60 * 1000;
const SEARCH_TIMEOUT_MS = 120000; // 2 min

function normalizeSearchQuery(q) {
    return String(q || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

router.get("/search-intent", verifyToken, async (req, res) => {
    const rawQuery = String(req.query.q || "").trim();
    if (rawQuery.length < 2 || rawQuery.length > 160) {
        return res.status(400).json({
            status: "error",
            message: "Query invalida (entre 2 e 160 caracteres)."
        });
    }

    const cacheKey = `intent:${normalizeSearchQuery(rawQuery)}`;
    const cached = searchIntentCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
        return res.json({
            status: "ok",
            cached: true,
            intent: cached.intent
        });
    }

    const intent = await resolveProductSearchIntent(rawQuery);
    searchIntentCache.set(cacheKey, { at: Date.now(), intent });

    return res.json({
        status: "ok",
        cached: false,
        intent
    });
});

// Pesquisa de produtos por texto livre (scraper + cache)
router.get("/search", verifyToken, async (req, res) => {
    const rawQuery = String(req.query.q || "").trim();
    if (rawQuery.length < 2 || rawQuery.length > 80) {
        return res.status(400).json({
            status: "error",
            message: "Query inválida (entre 2 e 80 caracteres).",
            results: []
        });
    }
    const cacheKey = normalizeSearchQuery(rawQuery);
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL_MS) {
        return res.json({
            status: "ok",
            cached: true,
            query: rawQuery,
            results: cached.results,
            count: cached.results.length
        });
    }

    const scraperPath = path.join(__dirname, '../../python-scraper/start.py');
    const escapedQuery = rawQuery.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const command = `${pythonExec} "${scraperPath}" --search "${escapedQuery}"`;

    try {
        const { stdout, stderr } = await execAsync(command, {
            cwd: path.join(__dirname, '../../'),
            timeout: SEARCH_TIMEOUT_MS,
            maxBuffer: 10 * 1024 * 1024
        });
        if (stderr && !stderr.includes('INFO')) {
            console.warn(`[SEARCH] Stderr: ${stderr.substring(0, 400)}`);
        }
        const jsonMatch = stdout.match(/\{[\s\S]*\}\s*$/);
        if (!jsonMatch) {
            console.error(`[SEARCH] JSON não encontrado. stdout: ${stdout.substring(0, 400)}`);
            return res.status(500).json({
                status: "error",
                message: "Falha ao interpretar resultados do scraper.",
                results: []
            });
        }
        let parsed;
        try {
            parsed = JSON.parse(jsonMatch[0]);
        } catch (parseErr) {
            console.error(`[SEARCH] Erro parse JSON: ${parseErr.message}`);
            return res.status(500).json({
                status: "error",
                message: "Resposta inválida do scraper.",
                results: []
            });
        }
        const results = Array.isArray(parsed.results) ? parsed.results : [];
        // Cache somente sucessos não-vazios para não fixar resultado vazio
        if (results.length > 0) {
            searchCache.set(cacheKey, { at: Date.now(), results });
        }
        res.json({
            status: "ok",
            cached: false,
            query: rawQuery,
            results,
            count: results.length
        });
    } catch (err) {
        console.error(`[SEARCH] Erro de execução: ${err.message}`);
        return res.status(500).json({
            status: "error",
            message: "Erro ao executar pesquisa.",
            results: []
        });
    }
});

//  Listar produtos do utilizador
router.get("/", verifyToken, async (req, res) => {
    try {
        console.log(" [BACKEND] Buscando produtos para ReferenciaID:", req.user.ReferenciaID);
        
        // Buscar produtos com data criada e link
        const [produtos] = await pool.query(
            `SELECT p.Id, p.Nome, p.Link, p.PrecoAtual, p.PrecoAlvo, p.CreatedAt as DataCriacao, p.DataLimite, 
                    COALESCE(l.Nome, 'Loja') as Loja
             FROM produtos p
             LEFT JOIN lojas l ON l.Id = p.LojaId
             WHERE p.ReferenciaID = ? AND p.DeletedAt IS NULL`,
            [req.user.ReferenciaID]
        );

        console.log(" [BACKEND] Produtos encontrados:", produtos.length);

        // Buscar histórico de preços separado
        let historicos = [];
        if (produtos.length > 0) {
            const produtoIds = produtos.map(p => p.Id);
            const inPlaceholders = produtoIds.map(() => "?").join(",");
            const [historicosResult] = await pool.query(
                `SELECT ProdutoId, Preco, DataRegisto
                 FROM historicoprecos 
                 WHERE ProdutoId IN (${inPlaceholders})`,
                produtoIds
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
            "SELECT Preco, DataRegisto FROM historicoprecos WHERE ProdutoId = ? ORDER BY DataRegisto DESC",
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

//  Clicou no botão "Ir ao site" = soma o preço alvo do produto ao dinheiro poupado (1 vez por produto).
router.post("/:id/registar-poupanca", verifyToken, async (req, res) => {
    const produtoId = parseInt(req.params.id, 10);
    const referenciaID = req.user.ReferenciaID;
    let connection;
    try {
        if (!produtoId || isNaN(produtoId)) {
            return res.status(400).json({ status: "error", message: "ID de produto inválido" });
        }

        const [prodRows] = await pool.query(
            "SELECT Id, Nome, PrecoAlvo FROM produtos WHERE Id = ? AND ReferenciaID = ? AND DeletedAt IS NULL",
            [produtoId, referenciaID]
        );
        if (prodRows.length === 0) {
            return res.status(404).json({ status: "error", message: "Produto não encontrado" });
        }

        const p = prodRows[0];
        const valorPoupado = p.PrecoAlvo != null ? Math.max(0, Number(p.PrecoAlvo)) : 0;
        if (valorPoupado <= 0) {
            return res.json({ status: "ok", registado: false, message: "Produto sem preço alvo" });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        await connection.query("SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ? FOR UPDATE", [referenciaID]);

        let existentes = [];
        try {
            [existentes] = await connection.query(
                "SELECT Id FROM notificacoes WHERE ReferenciaID = ? AND ProdutoId = ? AND COALESCE(ValorPoupado,0) > 0 LIMIT 1",
                [referenciaID, produtoId]
            );
        } catch (_) {}
        if (existentes.length > 0) {
            await connection.rollback();
            connection.release();
            return res.json({ status: "ok", registado: false, jaRegistado: true });
        }

        await connection.query(
            "UPDATE utilizadores SET dinheiro_poupado = COALESCE(dinheiro_poupado, 0) + ? WHERE ReferenciaID = ?",
            [valorPoupado, referenciaID]
        );
        try {
            await connection.query(
                `INSERT INTO notificacoes (ReferenciaID, ProdutoId, Tipo, Mensagem, Enviada, DataEnvio, ValorPoupado)
                 VALUES (?, ?, 'meta_atingida', ?, 1, NOW(), ?)`,
                [referenciaID, produtoId, `Meta: ${p.Nome || "Produto"}. Preço alvo €${valorPoupado.toFixed(2)}.`, valorPoupado]
            );
        } catch (_) {}
        await connection.commit();
        connection.release();
        connection = null;
        return res.json({ status: "ok", registado: true, valorPoupado });
    } catch (err) {
        if (connection) {
            try { await connection.rollback(); } catch (_) {}
            try { connection.release(); } catch (_) {}
        }
        console.error("[REGISTAR-POUPANCA] Erro:", err.message);
        res.status(500).json({ status: "error", message: "Erro ao registar poupança" });
    }
});

//  Editar produto
router.put("/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, link, data } = req.body;
        const nomeVal = nome ?? null;
        let linkVal = link ?? null;
        const dataVal = data ?? null;

        if (linkVal != null && linkVal !== "" && !isAllowedProductUrl(linkVal)) {
            return res.status(400).json({
                status: "error",
                message: "O link do produto deve ser um URL válido (http ou https)."
            });
        }

        const [result] = await pool.query(
            "UPDATE Produtos SET Nome=COALESCE(?, Nome), Link=COALESCE(?, Link), DataLimite=COALESCE(?, DataLimite) WHERE Id=? AND ReferenciaID=?",
            [nomeVal, linkVal, dataVal, id, req.user.ReferenciaID]
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
            "DELETE FROM produtos WHERE Id=? AND ReferenciaID=?",
            [id, req.user.ReferenciaID]
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

//  Comparar produto em múltiplas lojas (novo fluxo isolado)
router.post("/:id/compare", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Verificar se produto pertence ao usuário
        const [productRows] = await pool.query(
            "SELECT Link FROM produtos WHERE Id = ? AND ReferenciaID = ? AND DeletedAt IS NULL",
            [id, req.user.ReferenciaID]
        );
        
        if (productRows.length === 0) {
            return res.status(404).json({
                status: "error",
                message: "Produto não encontrado"
            });
        }
        
        const productLink = productRows[0].Link;
        
        // Executar comparação via Python
        const scraperPath = path.join(__dirname, '../../python-scraper/start.py');
        const escapedLink = productLink.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        const command = `${pythonExec} "${scraperPath}" --compare-simple "${escapedLink}"`;
        
        console.log(`[COMPARE] Comparando produto ${id} em múltiplas lojas...`);
        
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: path.join(__dirname, '../../'),
                timeout: 120000 // 2 minutos de timeout
            });
            
            if (stderr && !stderr.includes('INFO')) {
                console.error(`[COMPARE] Stderr: ${stderr}`);
            }
            
            // Parse JSON do stdout
            let comparisons = [];
            try {
                const jsonOutput = stdout.trim();
                // Tentar extrair JSON do output (pode ter logs antes)
                const jsonMatch = jsonOutput.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    comparisons = JSON.parse(jsonMatch[0]);
                } else {
                    // Tentar parse direto
                    comparisons = JSON.parse(jsonOutput);
                }
            } catch (parseError) {
                console.error(`[COMPARE] Erro ao parsear JSON: ${parseError.message}`);
                console.error(`[COMPARE] Output recebido: ${stdout.substring(0, 500)}`);
                return res.status(500).json({
                    status: "error",
                    message: "Erro ao processar resultados da comparação",
                    comparisons: []
                });
            }
            
            console.log(`[COMPARE] Encontrados ${comparisons.length} produtos comparáveis`);
            
            res.json({
                status: "ok",
                message: "Comparação concluída",
                comparisons: comparisons,
                count: comparisons.length
            });
            
        } catch (execError) {
            console.error(`[COMPARE] Erro na execução: ${execError.message}`);
            return res.status(500).json({
                status: "error",
                message: "Erro ao executar comparação de produtos",
                error: execError.message,
                comparisons: []
            });
        }
        
    } catch (err) {
        console.error("Erro ao comparar produto:", err);
        res.status(500).json({
            status: "error",
            message: "Erro interno do servidor"
        });
    }
});

//  Verificar se há produtos atualizados recentemente
router.get("/sync", verifyToken, async (req, res) => {
    try {
        const referenciaID = req.user.ReferenciaID;
        const { lastSync } = req.query;
        
        let query = `
            SELECT Id, Nome, PrecoAtual, UpdatedAt 
            FROM produtos 
            WHERE ReferenciaID = ?
        `;
        let params = [referenciaID];
        
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
