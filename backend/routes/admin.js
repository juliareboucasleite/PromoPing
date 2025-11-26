/**
 * Rotas Administrativas - PromoPing Admin
 * Endpoints para o painel administrativo
 */

import express from "express";
import {
    pool
} from "../database/db.js";
import {
    verifyToken
} from "../middleware/auth.js";

const router = express.Router();

// Helper para tratar erros de conexão com banco de dados
function handleDatabaseError(err, res, defaultMessage) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        return res.status(503).json({
            status: "error",
            error: "Banco de dados não está acessível. Verifique se o MySQL está rodando."
        });
    }
    return res.status(500).json({
        status: "error",
        error: defaultMessage || "Erro interno do servidor"
    });
}

// Middleware para verificar se é admin
async function verifyAdmin(req, res, next) {
    console.log("[ADMIN] verifyAdmin chamado para:", req.path);
    try {
        const userId = req.user && req.user.id;
        console.log("[ADMIN] UserId:", userId);
        if (!userId) {
            console.log("[ADMIN] Usuário não autenticado");
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        const [rows] = await pool.query(
            "SELECT PerfilId FROM Utilizadores WHERE Id = ?",
            [userId]
        );

        if (rows.length === 0 || (rows[0].PerfilId !== 1)) {
            return res.status(403).json({
                status: "error",
                error: "Acesso negado. Apenas administradores."
            });
        }

        console.log(`[ADMIN] Usuário ${userId} é admin. Acesso permitido.`);
        next();
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar admin:", err);
        return handleDatabaseError(err, res, "Erro ao verificar permissões");
    }
}

// Aplicar verificação de admin em todas as rotas
// IMPORTANTE: verifyToken deve ser aplicado primeiro
router.use(verifyToken);
router.use(verifyAdmin);

// ================== UTILIZADORES ==================
router.get("/users", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/users chamado");
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const [users] = await pool.query(
            `SELECT 
                u.Id,
                u.Nome,
                u.Email,
                u.Data_Registo,
                u.Ativo,
                u.EmailVerificado,
                u.PerfilId,
                COUNT(DISTINCT p.Id) as produtosCount,
                COUNT(DISTINCT n.Id) as notificacoesCount
            FROM Utilizadores u
            LEFT JOIN Produtos p ON p.UserId = u.Id AND p.DeletedAt IS NULL
            LEFT JOIN Notificacoes n ON n.UserId = u.Id
            WHERE u.Ativo = 1
            GROUP BY u.Id
            ORDER BY u.Data_Registo DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [total] = await pool.query(
            "SELECT COUNT(*) as total FROM Utilizadores WHERE Ativo = 1"
        );

        res.json({
            status: "ok",
            users: users,
            total: (total[0] && total[0].total) ? total[0].total : 0
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar utilizadores:", err);
        return handleDatabaseError(err, res, "Erro ao buscar utilizadores");
    }
});

// ================== PRODUTOS ==================
router.get("/products", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/products chamado");
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const [products] = await pool.query(
            `SELECT 
                p.Id,
                p.Nome,
                p.Link,
                p.PrecoAtual,
                p.PrecoAlvo,
                p.DataCriacao,
                p.Loja,
                u.Nome as UserName,
                u.Email as UserEmail,
                (SELECT COUNT(*) FROM HistoricoPrecos WHERE ProdutoId = p.Id) as historicoCount
            FROM Produtos p
            LEFT JOIN Utilizadores u ON u.Id = p.UserId
            WHERE p.DeletedAt IS NULL
            ORDER BY p.DataCriacao DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [total] = await pool.query(
            "SELECT COUNT(*) as total FROM Produtos WHERE DeletedAt IS NULL"
        );

        res.json({
            status: "ok",
            products: products,
            total: (total[0] && total[0].total) ? total[0].total : 0
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar produtos:", err);
        return handleDatabaseError(err, res, "Erro ao buscar produtos");
    }
});

// ================== AVALIAÇÕES ==================
router.get("/reviews", async (req, res) => {
    try {
        // Por enquanto, retornar estrutura vazia até criar tabela de avaliações
        // Pode ser implementado depois
        res.json({
            status: "ok",
            reviews: [],
            total: 0,
            message: "Sistema de avaliações em desenvolvimento"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar avaliações:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao buscar avaliações"
        });
    }
});

// ================== BUGS E PROJETOS ==================
router.get("/bugs", async (req, res) => {
    try {
        await ensureBugsTable();

        const [bugs] = await pool.query(
            `SELECT * FROM BugsProjetos 
            ORDER BY DataCriacao DESC 
            LIMIT 100`
        );

        res.json({
            status: "ok",
            bugs: bugs,
            total: bugs.length
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar bugs:", err);
        return handleDatabaseError(err, res, "Erro ao buscar bugs");
    }
});

router.post("/bugs", async (req, res) => {
    try {
        await ensureBugsTable();

        const {
            titulo,
            descricao,
            tipo,
            prioridade,
            status
        } = req.body;

        if (!titulo || !descricao) {
            return res.status(400).json({
                status: "error",
                error: "Título e descrição são obrigatórios"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO BugsProjetos (Titulo, Descricao, Tipo, Prioridade, Status) 
            VALUES (?, ?, ?, ?, ?)`,
            [
                titulo,
                descricao,
                tipo || 'bug',
                prioridade || 'medium',
                status || 'open'
            ]
        );

        res.json({
            status: "ok",
            id: result.insertId,
            message: "Bug/Projeto criado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao criar bug:", err);
        return handleDatabaseError(err, res, "Erro ao criar bug");
    }
});

router.patch("/bugs/:id", async (req, res) => {
    try {
        await ensureBugsTable();

        const {
            id
        } = req.params;
        const {
            status,
            prioridade
        } = req.body;

        const updates = [];
        const values = [];

        if (status) {
            updates.push("Status = ?");
            values.push(status);
        }
        if (prioridade) {
            updates.push("Prioridade = ?");
            values.push(prioridade);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Nenhum campo para atualizar"
            });
        }

        values.push(id);

        await pool.query(
            `UPDATE BugsProjetos SET ${updates.join(", ")} WHERE Id = ?`,
            values
        );

        res.json({
            status: "ok",
            message: "Bug/Projeto atualizado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao atualizar bug:", err);
        return handleDatabaseError(err, res, "Erro ao atualizar bug");
    }
});

// ================== INCIDENTES ==================
router.get("/incidents", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/incidents chamado");
    try {
        await ensureIncidentsTable();

        const [incidents] = await pool.query(
            `SELECT * FROM incidentes 
            ORDER BY DataInicio DESC 
            LIMIT 100`
        );

        console.log("[ADMIN] Incidentes encontrados:", incidents.length);

        res.json({
            status: "ok",
            incidents: incidents || [],
            total: incidents ? incidents.length : 0
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar incidentes:", err);
        return handleDatabaseError(err, res, "Erro ao buscar incidentes");
    }
});

router.post("/incidents", async (req, res) => {
    try {
        await ensureIncidentsTable();

        const {
            titulo,
            descricao,
            componenteAfetado,
            status
        } = req.body;

        if (!titulo || !descricao) {
            return res.status(400).json({
                status: "error",
                error: "Título e descrição são obrigatórios"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO incidentes (Titulo, Descricao, ComponenteAfetado, Status, DataInicio) 
            VALUES (?, ?, ?, ?, NOW())`,
            [
                titulo,
                descricao,
                componenteAfetado || null,
                status || 'investigating'
            ]
        );

        res.json({
            status: "ok",
            id: result.insertId,
            message: "Incidente criado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao criar incidente:", err);
        return handleDatabaseError(err, res, "Erro ao criar incidente");
    }
});

// ================== ATUALIZAÇÕES ==================
router.get("/updates", async (req, res) => {
    try {
        await ensureUpdatesTable();

        const [updates] = await pool.query(
            `SELECT * FROM atualizacoes_sistema 
            ORDER BY DataCriacao DESC 
            LIMIT 100`
        );

        res.json({
            status: "ok",
            updates: updates,
            total: updates.length
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar atualizações:", err);
        return handleDatabaseError(err, res, "Erro ao buscar atualizações");
    }
});

router.post("/updates", async (req, res) => {
    try {
        await ensureUpdatesTable();

        const {
            titulo,
            descricao,
            tipo
        } = req.body;

        if (!titulo || !descricao) {
            return res.status(400).json({
                status: "error",
                error: "Título e descrição são obrigatórios"
            });
        }

        const [result] = await pool.query(
            `INSERT INTO atualizacoes_sistema (Titulo, Descricao, Tipo) 
            VALUES (?, ?, ?)`,
            [titulo, descricao, tipo || 'feature']
        );

        res.json({
            status: "ok",
            id: result.insertId,
            message: "Atualização criada com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao criar atualização:", err);
        return handleDatabaseError(err, res, "Erro ao criar atualização");
    }
});

// ================== UTILITÁRIOS ==================
async function ensureBugsTable() {
    const sql = `CREATE TABLE IF NOT EXISTS BugsProjetos (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Titulo VARCHAR(200) NOT NULL,
        Descricao TEXT,
        Tipo ENUM('bug', 'projeto', 'melhoria') DEFAULT 'bug',
        Prioridade ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        Status ENUM('open', 'in-progress', 'resolved', 'closed') DEFAULT 'open',
        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (Status),
        INDEX idx_tipo (Tipo),
        INDEX idx_data_criacao (DataCriacao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    await pool.query(sql);
}

async function ensureIncidentsTable() {
    // Verificar se a tabela existe
    try {
        const [tables] = await pool.query(
            "SHOW TABLES LIKE 'incidentes'"
        );

        if (tables.length === 0) {
            console.log("[ADMIN] Criando tabela incidentes...");
            const sql = `CREATE TABLE IF NOT EXISTS incidentes (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                Titulo VARCHAR(200) NOT NULL,
                Descricao TEXT,
                DataInicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                DataFim TIMESTAMP NULL,
                Duracao VARCHAR(50),
                Impacto TEXT,
                Status ENUM('investigating', 'identified', 'monitoring', 'resolved') DEFAULT 'investigating',
                ComponenteAfetado VARCHAR(100),
                DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                DataAtualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_data_inicio (DataInicio),
                INDEX idx_status (Status),
                INDEX idx_componente (ComponenteAfetado)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
            await pool.query(sql);
            console.log("[ADMIN] Tabela incidentes criada com sucesso");
        } else {
            console.log("[ADMIN] Tabela incidentes já existe");
        }
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar/criar tabela incidentes:", err);
        throw err;
    }
}

async function ensureUpdatesTable() {
    const sql = `CREATE TABLE IF NOT EXISTS atualizacoes_sistema (
        Id INT AUTO_INCREMENT PRIMARY KEY,
        Titulo VARCHAR(200) NOT NULL,
        Descricao TEXT,
        Tipo ENUM('feature', 'fix', 'improvement', 'maintenance') DEFAULT 'feature',
        DataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tipo (Tipo),
        INDEX idx_data_criacao (DataCriacao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

    await pool.query(sql);
}

export default router;