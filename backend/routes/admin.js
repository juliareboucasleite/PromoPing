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
import { google } from "googleapis";

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
        const referenciaID = req.user && req.user.ReferenciaID;
        console.log("[ADMIN] ReferenciaID:", referenciaID);
        if (!referenciaID) {
            console.log("[ADMIN] Usuário não autenticado");
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        const [rows] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (rows.length === 0 || (rows[0].PerfilId !== 1)) {
            return res.status(403).json({
                status: "error",
                error: "Acesso negado. Apenas administradores."
            });
        }

        console.log(`[ADMIN] Usuário ${referenciaID} é admin. Acesso permitido.`);
        next();
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar admin:", err);
        return handleDatabaseError(err, res, "Erro ao verificar permissões");
    }
}

// Aplicar verificação de admin em todas as rotas
// IMPORTANTE: verifyToken deve ser aplicado primeiro
// EXCEÇÃO: /calendar/google-callback não precisa de autenticação (é callback do Google)
router.use((req, res, next) => {
    // Excluir callback do Google da verificação de token
    if (req.path === '/calendar/google-callback') {
        return next();
    }
    verifyToken(req, res, next);
});

router.use((req, res, next) => {
    // Excluir callback do Google da verificação de admin
    if (req.path === '/calendar/google-callback') {
        return next();
    }
    // verifyAdmin é async mas usa res.json() diretamente, então não precisa await
    verifyAdmin(req, res, next);
});

// ================== UTILIZADORES ==================
router.get("/users", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/users chamado");
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;

        const [users] = await pool.query(
            `SELECT 
                u.ReferenciaID,
                u.Nome,
                u.Email,
                u.DataRegisto,
                u.Ativo,
                u.EmailVerificado,
                u.PerfilId,
                COUNT(DISTINCT p.Id) as produtosCount,
                COUNT(DISTINCT n.Id) as notificacoesCount
            FROM utilizadores u
            LEFT JOIN produtos p ON p.ReferenciaID = u.ReferenciaID AND p.DeletedAt IS NULL
            LEFT JOIN notificacoes n ON n.ReferenciaID = u.ReferenciaID
            WHERE u.Ativo = 1
            GROUP BY u.ReferenciaID
            ORDER BY u.DataRegisto DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [total] = await pool.query(
            "SELECT COUNT(*) as total FROM utilizadores WHERE Ativo = 1"
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

router.patch("/users/:referenciaID", async (req, res) => {
    console.log("[ADMIN] PATCH /api/admin/users/:referenciaID chamado");
    try {
        const { referenciaID } = req.params;
        const { Nome, Email, Ativo, EmailVerificado } = req.body;

        if (!Nome || !Email) {
            return res.status(400).json({
                status: "error",
                error: "Nome e Email são obrigatórios"
            });
        }

        // Verificar se o usuário existe
        const [existing] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Utilizador não encontrado"
            });
        }

        // Verificar se o email já está em uso por outro usuário
        const [emailCheck] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE Email = ? AND ReferenciaID != ?",
            [Email, referenciaID]
        );

        if (emailCheck.length > 0) {
            return res.status(400).json({
                status: "error",
                error: "Este email já está em uso por outro utilizador"
            });
        }

        // Atualizar o usuário
        const updates = [];
        const values = [];

        if (Nome !== undefined) {
            updates.push("Nome = ?");
            values.push(Nome);
        }
        if (Email !== undefined) {
            updates.push("Email = ?");
            values.push(Email);
        }
        if (Ativo !== undefined) {
            updates.push("Ativo = ?");
            values.push(Ativo ? 1 : 0);
        }
        if (EmailVerificado !== undefined) {
            updates.push("EmailVerificado = ?");
            values.push(EmailVerificado ? 1 : 0);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Nenhum campo para atualizar"
            });
        }

        values.push(referenciaID);

        await pool.query(
            `UPDATE utilizadores SET ${updates.join(", ")} WHERE ReferenciaID = ?`,
            values
        );

        res.json({
            status: "ok",
            message: "Utilizador atualizado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao atualizar utilizador:", err);
        return handleDatabaseError(err, res, "Erro ao atualizar utilizador");
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
                p.CreatedAt as DataCriacao,
                l.nome as Loja,
                u.Nome as UserName,
                u.Email as UserEmail,
                (SELECT COUNT(*) FROM historicoprecos WHERE ProdutoId = p.Id) as historicoCount
            FROM produtos p
            LEFT JOIN utilizadores u ON u.ReferenciaID = p.ReferenciaID
            LEFT JOIN lojas l ON l.id = p.LojaId
            WHERE p.DeletedAt IS NULL
            ORDER BY p.CreatedAt DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        const [total] = await pool.query(
            "SELECT COUNT(*) as total FROM produtos WHERE DeletedAt IS NULL"
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
// Função para garantir que a tabela reviews existe
async function ensureReviewsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INT AUTO_INCREMENT PRIMARY KEY,
                discord_user_id VARCHAR(20) NOT NULL,
                discord_username VARCHAR(100) NOT NULL,
                discord_avatar_url VARCHAR(500) NULL,
                tipo ENUM('site', 'bot', 'suporte') NOT NULL,
                texto TEXT NOT NULL,
                rating INT NULL,
                is_anonimo TINYINT(1) DEFAULT 0,
                discord_channel_id VARCHAR(20) NULL,
                discord_message_id VARCHAR(20) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_discord_user_id (discord_user_id),
                INDEX idx_tipo (tipo),
                INDEX idx_rating (rating),
                INDEX idx_created_at (created_at),
                INDEX idx_is_anonimo (is_anonimo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    } catch (err) {
        console.error("[ADMIN] Erro ao criar tabela reviews:", err);
    }
}

router.get("/reviews", verifyToken, async (req, res) => {
    try {
        await ensureReviewsTable();

        // Parâmetros de filtro e paginação
        const tipo = req.query.tipo; // 'site', 'bot', 'suporte'
        const rating = req.query.rating; // 1-5
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Construir query com JOIN para pegar dados do usuário
        let query = `SELECT 
            r.Id,
            r.ReferenciaID,
            r.Tipo as tipo,
            r.Texto as texto,
            r.Rating as rating,
            CASE WHEN r.IsAnonimo = 1 THEN 1 ELSE 0 END as is_anonimo,
            r.CreatedAt as created_at,
            u.Nome as user_nome,
            u.Email as user_email
        FROM reviews r
        LEFT JOIN utilizadores u ON r.ReferenciaID = u.ReferenciaID
        WHERE 1=1`;
        const params = [];

        if (tipo) {
            query += " AND r.Tipo = ?";
            params.push(tipo);
        }

        if (rating) {
            query += " AND r.Rating = ?";
            params.push(parseInt(rating));
        }

        query += " ORDER BY r.CreatedAt DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [reviews] = await pool.query(query, params);

        // Contar total
        let countQuery = "SELECT COUNT(*) as total FROM reviews WHERE 1=1";
        const countParams = [];

        if (tipo) {
            countQuery += " AND Tipo = ?";
            countParams.push(tipo);
        }

        if (rating) {
            countQuery += " AND Rating = ?";
            countParams.push(parseInt(rating));
        }

        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        // Calcular estatísticas
        const [statsResult] = await pool.query(`
            SELECT 
                Tipo as tipo,
                COUNT(*) as total,
                AVG(Rating) as media_rating,
                SUM(CASE WHEN Rating >= 4 THEN 1 ELSE 0 END) as positivas,
                SUM(CASE WHEN Rating <= 2 THEN 1 ELSE 0 END) as negativas
            FROM reviews
            WHERE Rating IS NOT NULL
            GROUP BY Tipo
        `);

        res.json({
            status: "ok",
            reviews: reviews,
            total: total,
            page: page,
            limit: limit,
            totalPages: Math.ceil(total / limit),
            stats: statsResult
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar avaliações:", err);
        res.status(500).json({
            status: "error",
            error: "Erro ao buscar avaliações",
            message: err.message
        });
    }
});

// ================== BUGS E PROJETOS ==================
router.get("/bugs", async (req, res) => {
    try {
        await ensureBugsTable();

        const [bugs] = await pool.query(
            `SELECT * FROM bugsprojetos 
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
            `INSERT INTO bugsprojetos (Titulo, Descricao, Tipo, Prioridade, Status) 
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
        console.error("Erro ao criar bug:", err);
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
            `UPDATE bugsprojetos SET ${updates.join(", ")} WHERE Id = ?`,
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
    console.log("GET /api/admin/incidents chamado");
    try {
        await ensureIncidentsTable();

        const [incidents] = await pool.query(
            `SELECT * FROM incidentes 
            ORDER BY DataInicio DESC 
            LIMIT 100`
        );

        console.log("Incidentes encontrados:", incidents.length);

        res.json({
            status: "ok",
            incidents: incidents || [],
            total: incidents ? incidents.length : 0
        });
    } catch (err) {
        console.error("Erro ao buscar incidentes:", err);
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
    const sql = `CREATE TABLE IF NOT EXISTS bugsprojetos (
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

// ================== CALENDÁRIO ADMINISTRATIVO ==================
/**
 * Garante que a tabela admin_events existe
 */
/**
 * Garante que a tabela google_oauth_tokens existe
 */
async function ensureGoogleOAuthTokensTable() {
    try {
        const [tables] = await pool.query(
            "SHOW TABLES LIKE 'google_oauth_tokens'"
        );

        if (tables.length === 0) {
            console.log("[ADMIN] Criando tabela google_oauth_tokens...");
            const sql = `CREATE TABLE IF NOT EXISTS google_oauth_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ReferenciaID VARCHAR(13) NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                token_type VARCHAR(50) DEFAULT 'Bearer',
                expires_at TIMESTAMP NULL,
                scope TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ReferenciaID (ReferenciaID),
                INDEX idx_expires_at (expires_at),
                FOREIGN KEY (ReferenciaID) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE,
                UNIQUE KEY unique_user_token (ReferenciaID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
            await pool.query(sql);
            console.log("[ADMIN] Tabela google_oauth_tokens criada com sucesso");
        }
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar/criar tabela google_oauth_tokens:", err);
        throw err;
    }
}

/**
 * Renovar token do Google usando refresh_token
 */
async function refreshGoogleToken(referenciaID, refreshToken) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
        );

        oauth2Client.setCredentials({
            refresh_token: refreshToken
        });

        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Atualizar tokens no banco
        await pool.query(
            `UPDATE google_oauth_tokens 
             SET access_token = ?, 
                 expires_at = ?,
                 updated_at = NOW()
             WHERE ReferenciaID = ?`,
            [
                credentials.access_token,
                credentials.expiry_date ? new Date(credentials.expiry_date) : null,
                referenciaID
            ]
        );

        return credentials.access_token;
    } catch (err) {
        console.error("[ADMIN] Erro ao renovar token:", err);
        throw new Error("Erro ao renovar token do Google");
    }
}

/**
 * Sincronizar eventos do Google Calendar
 */
async function syncGoogleCalendarEvents(referenciaID, accessToken) {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL || `${process.env.BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: accessToken
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Buscar eventos dos próximos 90 dias
        const timeMin = new Date().toISOString();
        const timeMax = new Date();
        timeMax.setDate(timeMax.getDate() + 90);
        const timeMaxISO = timeMax.toISOString();

        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin,
            timeMax: timeMaxISO,
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];
        const syncedEvents = [];

        for (const googleEvent of events) {
            try {
                // Verificar se o evento já existe (por google_event_id)
                const [existing] = await pool.query(
                    `SELECT id FROM admin_events 
                     WHERE description LIKE ? OR title = ? 
                     LIMIT 1`,
                    [`%${googleEvent.id}%`, googleEvent.summary || '']
                );

                const startDate = googleEvent.start?.dateTime || googleEvent.start?.date;
                const endDate = googleEvent.end?.dateTime || googleEvent.end?.date;

                if (!startDate) continue;

                const eventData = {
                    title: googleEvent.summary || 'Evento sem título',
                    description: `${googleEvent.description || ''}\n\n[Google Calendar ID: ${googleEvent.id}]`,
                    type: 'maintenance', // Padrão, pode ser melhorado com categorias
                    start_date: new Date(startDate).toISOString().slice(0, 19).replace('T', ' '),
                    end_date: endDate ? new Date(endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
                    status: 'scheduled',
                    created_by: referenciaID
                };

                if (existing.length > 0) {
                    // Atualizar evento existente
                    await pool.query(
                        `UPDATE admin_events 
                         SET title = ?, description = ?, start_date = ?, end_date = ?, updated_at = NOW()
                         WHERE id = ?`,
                        [
                            eventData.title,
                            eventData.description,
                            eventData.start_date,
                            eventData.end_date,
                            existing[0].id
                        ]
                    );
                    syncedEvents.push({ id: existing[0].id, action: 'updated', title: eventData.title });
                } else {
                    // Criar novo evento
                    const [result] = await pool.query(
                        `INSERT INTO admin_events (title, description, type, start_date, end_date, status, created_by) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            eventData.title,
                            eventData.description,
                            eventData.type,
                            eventData.start_date,
                            eventData.end_date,
                            eventData.status,
                            eventData.created_by
                        ]
                    );
                    syncedEvents.push({ id: result.insertId, action: 'created', title: eventData.title });
                }
            } catch (eventErr) {
                console.error(`[ADMIN] Erro ao sincronizar evento ${googleEvent.id}:`, eventErr);
                // Continuar com próximo evento
            }
        }

        return syncedEvents;
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar eventos do Google Calendar:", err);
        throw new Error(`Erro ao sincronizar eventos: ${err.message}`);
    }
}

async function ensureAdminEventsTable() {
    try {
        const [tables] = await pool.query(
            "SHOW TABLES LIKE 'admin_events'"
        );

        if (tables.length === 0) {
            console.log("[ADMIN] Criando tabela admin_events...");
            const sql = `CREATE TABLE IF NOT EXISTS admin_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT,
                type ENUM('scraper', 'bug', 'maintenance', 'deploy', 'milestone') DEFAULT 'maintenance',
                start_date DATETIME NOT NULL,
                end_date DATETIME NULL,
                status ENUM('scheduled', 'in-progress', 'completed', 'cancelled') DEFAULT 'scheduled',
                created_by VARCHAR(13) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_start_date (start_date),
                INDEX idx_end_date (end_date),
                INDEX idx_type (type),
                INDEX idx_status (status),
                INDEX idx_created_by (created_by),
                FOREIGN KEY (created_by) REFERENCES utilizadores(ReferenciaID) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;
            await pool.query(sql);
            console.log("[ADMIN] Tabela admin_events criada com sucesso");
        } else {
            console.log("[ADMIN] Tabela admin_events já existe");
        }
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar/criar tabela admin_events:", err);
        throw err;
    }
}

/**
 * GET /api/admin/calendar/events
 * Lista todos os eventos do calendário
 */
router.get("/calendar/events", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/calendar/events chamado");
    try {
        await ensureAdminEventsTable();

        const { start, end } = req.query;

        let query = `
            SELECT 
                e.Id as id,
                e.Titulo as title,
                e.Descricao as description,
                e.Tipo as type,
                e.StartDate as start_date,
                e.EndDate as end_date,
                e.Status as status,
                e.CreatedBy as created_by,
                e.CreatedAt as created_at,
                e.UpdatedAt as updated_at,
                u.Nome as created_by_name,
                u.Email as created_by_email
            FROM admin_events e
            LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy
            WHERE 1=1
        `;
        const params = [];

        // Filtrar por intervalo de datas se fornecido
        if (start && end) {
            query += ` AND (
                (e.StartDate >= ? AND e.StartDate <= ?) OR
                (e.EndDate >= ? AND e.EndDate <= ?) OR
                (e.StartDate <= ? AND e.EndDate >= ?)
            )`;
            params.push(start, end, start, end, start, end);
        }

        query += ` ORDER BY e.StartDate ASC`;

        const [events] = await pool.query(query, params);

        // Formatar eventos para FullCalendar
        const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            type: event.type,
            start: event.start_date,
            end: event.end_date || null,
            status: event.status,
            createdBy: event.created_by,
            createdByName: event.created_by_name || 'Admin',
            createdAt: event.created_at,
            updatedAt: event.updated_at
        }));

        res.json({
            status: "ok",
            events: formattedEvents
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao buscar eventos:", err);
        return handleDatabaseError(err, res, "Erro ao buscar eventos do calendário");
    }
});

/**
 * POST /api/admin/calendar/events
 * Cria um novo evento
 */
router.post("/calendar/events", async (req, res) => {
    console.log("[ADMIN] POST /api/admin/calendar/events chamado");
    try {
        await ensureAdminEventsTable();

        const { title, description, type, start_date, end_date, status } = req.body;
        const referenciaID = req.user && req.user.ReferenciaID;

        if (!referenciaID) {
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        if (!title || !start_date) {
            return res.status(400).json({
                status: "error",
                error: "Título e data de início são obrigatórios"
            });
        }

        // Validar tipo
        const validTypes = ['scraper', 'bug', 'maintenance', 'deploy', 'milestone'];
        const eventType = validTypes.includes(type) ? type : 'maintenance';

        // Validar status
        const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled'];
        const eventStatus = validStatuses.includes(status) ? status : 'scheduled';

        const [result] = await pool.query(
            `INSERT INTO admin_events (Titulo, Descricao, Tipo, StartDate, EndDate, Status, CreatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                description || null,
                eventType,
                start_date,
                end_date || null,
                eventStatus,
                referenciaID
            ]
        );

        // Buscar o evento criado
        const [newEvent] = await pool.query(
            `SELECT 
                e.Id as id,
                e.Titulo as title,
                e.Descricao as description,
                e.Tipo as type,
                e.StartDate as start_date,
                e.EndDate as end_date,
                e.Status as status,
                e.CreatedBy as created_by,
                e.CreatedAt as created_at,
                e.UpdatedAt as updated_at,
                u.Nome as created_by_name,
                u.Email as created_by_email
            FROM admin_events e
            LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy
            WHERE e.Id = ?`,
            [result.insertId]
        );

        res.json({
            status: "ok",
            id: result.insertId,
            event: {
                id: newEvent[0].id,
                title: newEvent[0].title,
                description: newEvent[0].description || '',
                type: newEvent[0].type,
                start: newEvent[0].start_date,
                end: newEvent[0].end_date || null,
                status: newEvent[0].status,
                createdBy: newEvent[0].created_by,
                createdByName: newEvent[0].created_by_name || 'Admin',
                createdAt: newEvent[0].created_at,
                updatedAt: newEvent[0].updated_at
            },
            message: "Evento criado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao criar evento:", err);
        return handleDatabaseError(err, res, "Erro ao criar evento");
    }
});

/**
 * PUT /api/admin/calendar/events/:id
 * Atualiza um evento existente
 */
router.put("/calendar/events/:id", async (req, res) => {
    console.log("[ADMIN] PUT /api/admin/calendar/events/:id chamado");
    try {
        await ensureAdminEventsTable();

        const { id } = req.params;
        const { title, description, type, start_date, end_date, status } = req.body;

        // Verificar se o evento existe
        const [existing] = await pool.query(
            "SELECT * FROM admin_events WHERE Id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Evento não encontrado"
            });
        }

        // Construir query de atualização dinamicamente
        const updates = [];
        const values = [];

        if (title !== undefined) {
            updates.push("Titulo = ?");
            values.push(title);
        }
        if (description !== undefined) {
            updates.push("Descricao = ?");
            values.push(description);
        }
        if (type !== undefined) {
            const validTypes = ['scraper', 'bug', 'maintenance', 'deploy', 'milestone'];
            if (validTypes.includes(type)) {
                updates.push("Tipo = ?");
                values.push(type);
            }
        }
        if (start_date !== undefined) {
            updates.push("StartDate = ?");
            values.push(start_date);
        }
        if (end_date !== undefined) {
            updates.push("EndDate = ?");
            values.push(end_date);
        }
        if (status !== undefined) {
            const validStatuses = ['scheduled', 'in-progress', 'completed', 'cancelled'];
            if (validStatuses.includes(status)) {
                updates.push("Status = ?");
                values.push(status);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Nenhum campo para atualizar"
            });
        }

        values.push(id);

        await pool.query(
            `UPDATE admin_events SET ${updates.join(", ")} WHERE Id = ?`,
            values
        );

        // Buscar o evento atualizado
        const [updated] = await pool.query(
            `SELECT 
                e.*,
                u.Nome as created_by_name,
                u.Email as created_by_email
            FROM admin_events e
            LEFT JOIN utilizadores u ON u.ReferenciaID = e.created_by
            WHERE e.id = ?`,
            [id]
        );

        res.json({
            status: "ok",
            event: {
                id: updated[0].id,
                title: updated[0].title,
                description: updated[0].description || '',
                type: updated[0].type,
                start: updated[0].start_date,
                end: updated[0].end_date || null,
                status: updated[0].status,
                createdBy: updated[0].created_by,
                createdByName: updated[0].created_by_name || 'Admin',
                createdAt: updated[0].created_at,
                updatedAt: updated[0].updated_at
            },
            message: "Evento atualizado com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao atualizar evento:", err);
        return handleDatabaseError(err, res, "Erro ao atualizar evento");
    }
});

/**
 * DELETE /api/admin/calendar/events/:id
 * Remove um evento
 */
router.delete("/calendar/events/:id", async (req, res) => {
    console.log("[ADMIN] DELETE /api/admin/calendar/events/:id chamado");
    try {
        await ensureAdminEventsTable();

        const { id } = req.params;

        // Verificar se o evento existe
        const [existing] = await pool.query(
            "SELECT * FROM admin_events WHERE Id = ?",
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                status: "error",
                error: "Evento não encontrado"
            });
        }

        await pool.query("DELETE FROM admin_events WHERE Id = ?", [id]);

        res.json({
            status: "ok",
            message: "Evento removido com sucesso"
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao remover evento:", err);
        return handleDatabaseError(err, res, "Erro ao remover evento");
    }
});

/**
 * POST /api/admin/calendar/sync-google
 * Sincroniza eventos do Google Calendar (read-only)
 */
router.post("/calendar/sync-google", async (req, res) => {
    console.log("[ADMIN] POST /api/admin/calendar/sync-google chamado");
    try {
        await ensureAdminEventsTable();

        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        // Verificar se Google OAuth está configurado
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(400).json({
                status: "error",
                error: "Google OAuth não está configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env"
            });
        }

        // Garantir que a tabela de tokens existe
        await ensureGoogleOAuthTokensTable();

        // Buscar tokens OAuth do usuário
        const [tokenRows] = await pool.query(
            `SELECT access_token, refresh_token, expires_at 
             FROM google_oauth_tokens 
             WHERE ReferenciaID = ? AND (expires_at IS NULL OR expires_at > NOW())`,
            [referenciaID]
        );

        if (tokenRows.length === 0) {
            return res.status(400).json({
                status: "error",
                error: "Tokens OAuth não encontrados. Faça login com Google OAuth primeiro e autorize o acesso ao calendário."
            });
        }

        const tokenData = tokenRows[0];
        let accessToken = tokenData.access_token;

        // Verificar se o token expirou e renovar se necessário
        if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
            if (!tokenData.refresh_token) {
                return res.status(400).json({
                    status: "error",
                    error: "Token expirado e sem refresh token. Faça login novamente com Google OAuth."
                });
            }
            accessToken = await refreshGoogleToken(referenciaID, tokenData.refresh_token);
        }

        // Sincronizar eventos do Google Calendar
        const syncedEvents = await syncGoogleCalendarEvents(referenciaID, accessToken);

        res.json({
            status: "ok",
            message: "Sincronização concluída com sucesso",
            synced: syncedEvents.length,
            events: syncedEvents
        });

    } catch (err) {
        console.error("[ADMIN] Erro ao sincronizar Google Calendar:", err);
        return res.status(500).json({
            status: "error",
            error: err.message || "Erro ao sincronizar Google Calendar"
        });
    }
});

/**
 * GET /api/admin/calendar/connect-google
 * Inicia o processo de conexão com Google Calendar para usuário autenticado
 */
router.get("/calendar/connect-google", verifyToken, async (req, res) => {
    console.log("[ADMIN] GET /api/admin/calendar/connect-google chamado");
    try {
        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        // Verificar se Google OAuth está configurado
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(400).json({
                status: "error",
                error: "Google OAuth não está configurado"
            });
        }

        // Redirecionar para Google OAuth com state contendo ReferenciaID
        const baseUrl = process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
        const callbackUrl = `${baseUrl}/api/admin/calendar/google-callback`;
        
        // Criar state com ReferenciaID para segurança
        const state = Buffer.from(JSON.stringify({ ReferenciaID: referenciaID, source: 'calendar' })).toString('base64');
        
        // Construir URL de autorização do Google
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
            `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
            `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
            `response_type=code&` +
            `scope=${encodeURIComponent('profile email https://www.googleapis.com/auth/calendar.readonly')}&` +
            `access_type=offline&` +
            `prompt=consent&` +
            `state=${state}`;

        res.json({
            status: "ok",
            authUrl: authUrl
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao iniciar conexão Google:", err);
        return res.status(500).json({
            status: "error",
            error: err.message || "Erro ao iniciar conexão com Google"
        });
    }
});

/**
 * GET /api/admin/calendar/google-callback
 * Callback do Google OAuth para salvar tokens
 */
router.get("/calendar/google-callback", async (req, res) => {
    console.log("[ADMIN] GET /api/admin/calendar/google-callback chamado");
    try {
        const { code, state, error } = req.query;

        if (error) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro de Autorização</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f10; color: #e6e6e6; }
                        .error { color: #fca5a5; }
                        button { padding: 10px 20px; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Erro de Autorização</h1>
                    <p>${error}</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
                </html>
            `);
        }

        if (!code || !state) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f10; color: #e6e6e6; }
                        .error { color: #fca5a5; }
                        button { padding: 10px 20px; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Erro</h1>
                    <p>Código de autorização não recebido</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
                </html>
            `);
        }

        // Decodificar state
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        const referenciaID = stateData.ReferenciaID;

        if (!referenciaID) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f10; color: #e6e6e6; }
                        .error { color: #fca5a5; }
                        button { padding: 10px 20px; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Erro</h1>
                    <p>ID de usuário não encontrado</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
                </html>
            `);
        }

        // Trocar código por tokens
        const baseUrl = process.env.BASE_URL || process.env.API_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || 3000}`;
        const callbackUrl = `${baseUrl}/api/admin/calendar/google-callback`;

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: callbackUrl
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Erro</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f10; color: #e6e6e6; }
                        .error { color: #fca5a5; }
                        button { padding: 10px 20px; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">Erro</h1>
                    <p>Não foi possível obter tokens do Google</p>
                    <button onclick="window.close()">Fechar</button>
                </body>
                </html>
            `);
        }

        // Garantir que a tabela existe
        await ensureGoogleOAuthTokensTable();

        // Calcular data de expiração
        const expiresAt = tokenData.expires_in 
            ? new Date(Date.now() + tokenData.expires_in * 1000)
            : new Date(Date.now() + 3600 * 1000); // 1 hora padrão

        // Salvar tokens no banco
        await pool.query(
            `INSERT INTO google_oauth_tokens (ReferenciaID, access_token, refresh_token, expires_at, scope, token_type)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                 access_token = VALUES(access_token),
                 refresh_token = VALUES(refresh_token),
                 expires_at = VALUES(expires_at),
                 scope = VALUES(scope),
                 updated_at = NOW()`,
            [
                referenciaID,
                tokenData.access_token,
                tokenData.refresh_token || null,
                expiresAt,
                tokenData.scope || 'calendar.readonly',
                tokenData.token_type || 'Bearer'
            ]
        );

        console.log("[ADMIN] Tokens Google salvos para usuário:", referenciaID);

        // Retornar página de sucesso que fecha a janela e atualiza a página pai
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Conta Conectada</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        text-align: center; 
                        padding: 50px; 
                        background: #0f0f10; 
                        color: #e6e6e6; 
                    }
                    .success { 
                        color: #86efac; 
                        font-size: 24px;
                        margin-bottom: 20px;
                    }
                    p { 
                        margin: 20px 0; 
                    }
                    button { 
                        padding: 10px 20px; 
                        background: #ff9800; 
                        color: #0f0f10; 
                        border: none; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        margin-top: 20px; 
                        font-weight: 600;
                    }
                    button:hover {
                        background: #ffa726;
                    }
                </style>
            </head>
            <body>
                <div class="success">✓</div>
                <h1>Conta Google Conectada!</h1>
                <p>Sua conta do Google foi conectada com sucesso.</p>
                <p>Agora você pode sincronizar eventos do seu calendário.</p>
                <button onclick="window.opener ? window.opener.location.reload() : window.close(); window.close();">
                    Fechar e Atualizar
                </button>
                <script>
                    // Tentar fechar a janela após 2 segundos
                    setTimeout(() => {
                        if (window.opener) {
                            window.opener.location.reload();
                        }
                        window.close();
                    }, 2000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error("[ADMIN] Erro no callback Google:", err);
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Erro</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #0f0f10; color: #e6e6e6; }
                    .error { color: #fca5a5; }
                    button { padding: 10px 20px; background: #ff9800; color: #0f0f10; border: none; border-radius: 6px; cursor: pointer; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h1 class="error">Erro</h1>
                <p>${err.message || 'Erro ao conectar conta Google'}</p>
                <button onclick="window.close()">Fechar</button>
            </body>
            </html>
        `);
    }
});

/**
 * GET /api/admin/calendar/google-status
 * Verifica se o usuário tem tokens Google salvos
 */
router.get("/calendar/google-status", verifyToken, async (req, res) => {
    try {
        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({
                status: "error",
                error: "Não autenticado"
            });
        }

        await ensureGoogleOAuthTokensTable();

        const [tokenRows] = await pool.query(
            `SELECT expires_at, created_at 
             FROM google_oauth_tokens 
             WHERE ReferenciaID = ?`,
            [referenciaID]
        );

        const isConnected = tokenRows.length > 0;
        const isExpired = isConnected && tokenRows[0].expires_at && new Date(tokenRows[0].expires_at) < new Date();

        res.json({
            status: "ok",
            connected: isConnected,
            expired: isExpired,
            connectedAt: isConnected ? tokenRows[0].created_at : null
        });
    } catch (err) {
        console.error("[ADMIN] Erro ao verificar status Google:", err);
        return res.status(500).json({
            status: "error",
            error: err.message || "Erro ao verificar status"
        });
    }
});

export default router;