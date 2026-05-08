/**
 * Rotas Corporação - Painel para gestão dos funcionários (PerfilId = 3)
 * Acesso apenas a utilizadores com PerfilId === 3.
 */

import express from "express";
import { pool } from "../database/db.js";
import { requirePermission, requirePortalAccess, verifyToken } from "../middleware/auth.js";
import financialRouter from "./corporation-financial.js";
import auditRouter from "./corporation-audit.js";
import businessApplicationsRouter from "./corporation-business-applications.js";
import { logAudit } from "../utils/audit.js";
import { gerarReferenciaID } from "../utils/referenciaId.js";
import { listUserAccessRoles, syncLegacyAccessAssignments } from "../services/accessAssignments.service.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const router = express.Router();

function handleDatabaseError(err, res, defaultMessage) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'PROTOCOL_CONNECTION_LOST') {
        return res.status(503).json({
            status: "error",
            error: "Banco de dados não está acessível."
        });
    }
    return res.status(500).json({
        status: "error",
        error: defaultMessage || "Erro interno do servidor"
    });
}

async function tableExists(tableName) {
    const [rows] = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ?",
        [String(tableName || "").toLowerCase()]
    );
    return rows.length > 0;
}

async function columnExists(tableName, columnName) {
    const [rows] = await pool.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND table_name = ?
           AND column_name = ?
         LIMIT 1`,
        [String(tableName || "").toLowerCase(), String(columnName || "").toLowerCase()]
    );
    return rows.length > 0;
}

async function verifyCorporation(req, res, next) {
    try {
        const referenciaID = req.user && req.user.ReferenciaID;
        if (!referenciaID) {
            return res.status(401).json({ status: "error", error: "Não autenticado" });
        }
        const [rows] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (rows.length === 0 || !isCorporationProfile(rows[0].PerfilId)) {
            return res.status(403).json({
                status: "error",
                error: "Acesso negado. Apenas utilizadores corporativos."
            });
        }
        next();
    } catch (err) {
        console.error("[CORPORATION] Erro ao verificar perfil:", err);
        return handleDatabaseError(err, res, "Erro ao verificar permissões");
    }
}

router.use(verifyToken);
router.use(requirePortalAccess("corporation", "Acesso negado. Apenas utilizadores corporativos."));

// Sub-rotas financeiras (KPIs, transacções, payouts, export CSV)
router.use("/financial", financialRouter);
router.use("/business-applications", businessApplicationsRouter);
// Sub-rotas de auditoria (logs de acções)
router.use("/audit", auditRouter);

async function ensureCorporationDiscordCouponTables() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_coupon_requests (
            id SERIAL PRIMARY KEY,
            requested_by_referenciaid VARCHAR(13) NOT NULL,
            target_guild_id VARCHAR(25) NOT NULL,
            target_channel_id VARCHAR(25) NOT NULL,
            title VARCHAR(256) NULL,
            description TEXT NULL,
            color INTEGER NULL,
            image_url TEXT NULL,
            button_label VARCHAR(80) NULL,
            button_url TEXT NULL,
            coupon_code VARCHAR(64) NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            review_note TEXT NULL,
            reviewed_by_referenciaid VARCHAR(13) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP NULL
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_status
            ON discord_coupon_requests (status)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_created_at
            ON discord_coupon_requests (created_at)
    `);
    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_requests_requested_by
            ON discord_coupon_requests (requested_by_referenciaid)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_coupon_messages (
            id SERIAL PRIMARY KEY,
            sent_by_referenciaid VARCHAR(13) NOT NULL,
            guild_id VARCHAR(25) NOT NULL,
            channel_id VARCHAR(25) NOT NULL,
            title VARCHAR(256) NULL,
            description TEXT NULL,
            color INTEGER NULL,
            image_url TEXT NULL,
            button_label VARCHAR(80) NULL,
            button_url TEXT NULL,
            coupon_code VARCHAR(64) NULL,
            request_id INTEGER NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_coupon_messages_request_id
            ON discord_coupon_messages (request_id)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS discord_outbound_queue (
            id SERIAL PRIMARY KEY,
            guild_id VARCHAR(25) NOT NULL,
            channel_id VARCHAR(25) NOT NULL,
            payload JSONB NOT NULL,
            coupon_message_id INTEGER NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'queued',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_discord_outbound_queue_status
            ON discord_outbound_queue (status)
    `);
}

async function ensureCorporationDiscordGuildsTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS corporation_discord_guilds (
            guild_id VARCHAR(25) PRIMARY KEY,
            guild_name VARCHAR(255) NULL,
            guild_icon VARCHAR(255) NULL,
            added_by_referenciaid VARCHAR(13) NULL,
            added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            removed_at TIMESTAMP NULL
        )
    `);
}

/** Lista funcionários (suporte - PerfilId = 1) com detalhes */
router.get("/staff", requirePermission("corporation.staff.read", "PermissÃ£o insuficiente para ver colaboradores."), async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
        const profiles = req.query.includeCorp === '1' ? '(1, 3)' : '(1)';
        const activeFilter = includeInactive ? '' : 'AND u.Ativo = 1';

        const [staff] = await pool.query(
            `SELECT
                u.ReferenciaID,
                u.Nome,
                u.Email,
                u.Telefone,
                u.DataRegisto,
                u.PerfilId,
                u.Ativo,
                u.DataDesativacao,
                u.UltimoLogin,
                p.Nome AS PerfilNome
            FROM utilizadores u
            LEFT JOIN perfis p ON p.Id = u.PerfilId
            WHERE u.PerfilId IN ${profiles} ${activeFilter}
            ORDER BY u.Ativo DESC, u.Nome`
        );
        const roleMap = await listUserAccessRoles(staff.map((row) => row.ReferenciaID || row.referenciaid));
        res.json({
            status: "ok",
            staff: staff.map((row) => ({
                ...mapStaffRow(row),
                accessRoles: roleMap.get(row.ReferenciaID || row.referenciaid) || []
            }))
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar staff:", err);
        return handleDatabaseError(err, res, "Erro ao buscar funcionários");
    }
});

/** Detalhe de um funcionário */
router.get("/staff/:referenciaID", requirePermission("corporation.staff.read", "PermissÃ£o insuficiente para ver colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;
        const [rows] = await pool.query(
            `SELECT 
                u.ReferenciaID,
                u.Nome,
                u.Email,
                u.Telefone,
                u.DataRegisto,
                u.PerfilId,
                p.Nome AS PerfilNome
            FROM utilizadores u
            LEFT JOIN perfis p ON p.Id = u.PerfilId
            WHERE u.ReferenciaID = ? AND u.PerfilId IN (1, 3)`,
            [referenciaID]
        );
        if (rows.length === 0) {
            return res.status(404).json({ status: "error", error: "Funcionário não encontrado" });
        }
        const roleMap = await listUserAccessRoles([referenciaID]);
        res.json({
            status: "ok",
            staff: {
                ...mapStaffRow(rows[0]),
                accessRoles: roleMap.get(referenciaID) || []
            }
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar funcionário:", err);
        return handleDatabaseError(err, res, "Erro ao buscar funcionário");
    }
});

/** Atividade / projetos do funcionário: eventos, bugs/projetos, conversas de suporte, notificações que fez */
router.get("/staff/:referenciaID/activity", requirePermission("corporation.staff.read", "PermissÃ£o insuficiente para ver colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;

        const [user] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE ReferenciaID = ? AND PerfilId IN (1, 3)",
            [referenciaID]
        );
        if (user.length === 0) {
            return res.status(404).json({ status: "error", error: "Funcionário não encontrado" });
        }

        const [calendarEvents] = await pool.query(
            `SELECT e.Id, e.Titulo, e.Descricao, e.Tipo, e.Status, e.StartDate, e.EndDate
             FROM admin_events e
             WHERE e.CreatedBy = ?
             ORDER BY e.StartDate DESC
             LIMIT 50`,
            [referenciaID]
        ).catch(() => [[]]);

        let bugsProjetos = [];
        try {
            if (await columnExists("bugsprojetos", "CreatedBy")) {
                const [rows] = await pool.query(
                    `SELECT Id, Titulo, Tipo, Prioridade, Status, DataCriacao
                     FROM bugsprojetos WHERE CreatedBy = ?
                     ORDER BY DataCriacao DESC LIMIT 50`,
                    [referenciaID]
                );
                bugsProjetos = rows;
            }
        } catch (_) {}

        const hasSenderReference = await columnExists("supportmessages", "SenderReferenciaID").catch(() => false);
        const supportReferenceColumn = hasSenderReference ? "sm.SenderReferenciaID" : "sm.ReferenciaID";
        const [supportThreads] = await pool.query(
            `SELECT DISTINCT COALESCE(sm.threadId, sm.id) AS threadId
             FROM supportmessages sm
             WHERE ${supportReferenceColumn} = ? AND sm.senderType = 'support'
             ORDER BY threadId DESC
             LIMIT 50`,
            [referenciaID]
        ).catch(() => [[]]);

        const [notifications] = await pool.query(
            `SELECT Id, Tipo, Titulo, Descricao, DataCriacao
             FROM corporation_notifications
             WHERE ReferenciaID = ?
             ORDER BY DataCriacao DESC
             LIMIT 30`,
            [referenciaID]
        ).catch(() => [[]]);

        res.json({
            status: "ok",
            activity: {
                calendarEvents: (calendarEvents || []).map(mapCalendarEventRow),
                bugsProjetos: (bugsProjetos || []).map(mapBugProjetoRow),
                supportThreadsCount: Array.isArray(supportThreads) ? supportThreads.length : 0,
                notifications: Array.isArray(notifications) ? notifications.map(mapNotificationRow) : []
            }
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar atividade:", err);
        return handleDatabaseError(err, res, "Erro ao buscar atividade");
    }
});

// ===========================================================================
// Gestão de funcionários (criar/editar/suspender/reativar/reset-password)
// ===========================================================================

function generateTempPassword() {
    // 12 chars: 4 grupos legíveis separados por '-'
    const groups = [];
    for (let i = 0; i < 3; i++) {
        groups.push(crypto.randomBytes(2).toString('hex'));
    }
    return groups.join('-');
}

/** POST /staff — criar nova conta de funcionário (suporte) */
router.post("/staff", requirePermission("corporation.staff.manage", "PermissÃ£o insuficiente para gerir colaboradores."), async (req, res) => {
    try {
        const { nome, email, telefone, perfilId } = req.body;
        if (!nome || !email) {
            return res.status(400).json({ status: "error", error: "Nome e email são obrigatórios." });
        }
        const cleanEmail = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({ status: "error", error: "Email inválido." });
        }

        const [exists] = await pool.query(
            "SELECT ReferenciaID FROM utilizadores WHERE LOWER(Email) = ? LIMIT 1",
            [cleanEmail]
        );
        if (exists.length > 0) {
            return res.status(409).json({ status: "error", error: "Já existe uma conta com este email." });
        }

        const targetPerfil = [1, 3].includes(parseInt(perfilId)) ? parseInt(perfilId) : 1;
        const referenciaID = gerarReferenciaID();
        const tempPassword = generateTempPassword();
        const hash = await bcrypt.hash(tempPassword, 10);

        await pool.query(
            `INSERT INTO utilizadores
             (ReferenciaID, Nome, Email, SenhaHash, Telefone, Ativo, PerfilId, EmailVerificado, DataRegisto)
             VALUES (?, ?, ?, ?, ?, 1, ?, 1, NOW())`,
            [referenciaID, String(nome).trim().slice(0, 100), cleanEmail, hash, telefone ? String(telefone).slice(0, 20) : null, targetPerfil]
        );

        await syncLegacyAccessAssignments({
            referenciaID,
            perfilId: targetPerfil,
            assignedByReferenciaID: req.user?.ReferenciaID || null
        });

        logAudit(req, 'staff.create', {
            targetType: 'user',
            targetId: referenciaID,
            details: { nome: String(nome).trim(), email: cleanEmail, perfilId: targetPerfil }
        });

        res.status(201).json({
            status: "ok",
            message: "Funcionário criado.",
            staff: {
                ReferenciaID: referenciaID,
                Nome: nome,
                Email: cleanEmail,
                PerfilId: targetPerfil
            },
            tempPassword
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao criar funcionário:", err);
        return handleDatabaseError(err, res, "Erro ao criar funcionário");
    }
});

/** PUT /staff/:referenciaID — atualizar dados básicos (nome, telefone, perfil) */
router.put("/staff/:referenciaID", requirePermission("corporation.staff.manage", "PermissÃ£o insuficiente para gerir colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;
        const { nome, telefone, perfilId } = req.body;

        const [exists] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (exists.length === 0) {
            return res.status(404).json({ status: "error", error: "Utilizador não encontrado." });
        }
        const currentPerfil = exists[0].PerfilId ?? exists[0].perfilid;
        if (![1, 3].includes(currentPerfil)) {
            return res.status(400).json({ status: "error", error: "Só funcionários (suporte/corporação) podem ser editados aqui." });
        }

        const finalPerfil = (perfilId !== undefined && [1, 3].includes(parseInt(perfilId, 10)))
            ? parseInt(perfilId, 10)
            : Number(currentPerfil);

        const updates = [];
        const values = [];
        if (nome !== undefined) { updates.push("Nome = ?"); values.push(String(nome).trim().slice(0, 100)); }
        if (telefone !== undefined) { updates.push("Telefone = ?"); values.push(telefone ? String(telefone).slice(0, 20) : null); }
        if (perfilId !== undefined && [1, 3].includes(parseInt(perfilId, 10))) {
            updates.push("PerfilId = ?");
            values.push(finalPerfil);
        }
        if (updates.length === 0) {
            return res.json({ status: "ok", message: "Nada a actualizar." });
        }
        values.push(referenciaID);
        await pool.query(
            `UPDATE utilizadores SET ${updates.join(", ")}, UpdatedAt = NOW() WHERE ReferenciaID = ?`,
            values
        );

        await syncLegacyAccessAssignments({
            referenciaID,
            perfilId: finalPerfil,
            assignedByReferenciaID: req.user?.ReferenciaID || null
        });

        logAudit(req, 'staff.update', {
            targetType: 'user',
            targetId: referenciaID,
            details: { fields: updates.map(u => u.split(' = ')[0]) }
        });

        res.json({ status: "ok", message: "Funcionário actualizado." });
    } catch (err) {
        console.error("[CORPORATION] Erro ao actualizar funcionário:", err);
        return handleDatabaseError(err, res, "Erro ao actualizar funcionário");
    }
});

/** POST /staff/:referenciaID/suspend — desactivar conta */
router.post("/staff/:referenciaID/suspend", requirePermission("corporation.staff.manage", "PermissÃ£o insuficiente para gerir colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;
        if (referenciaID === req.user?.ReferenciaID) {
            return res.status(400).json({ status: "error", error: "Não podes suspender a tua própria conta." });
        }
        const [exists] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (exists.length === 0) {
            return res.status(404).json({ status: "error", error: "Utilizador não encontrado." });
        }
        await pool.query(
            "UPDATE utilizadores SET Ativo = 0, DataDesativacao = NOW(), UpdatedAt = NOW() WHERE ReferenciaID = ?",
            [referenciaID]
        );
        logAudit(req, 'staff.suspend', {
            targetType: 'user',
            targetId: referenciaID,
            details: { reason: req.body?.reason || null }
        });
        res.json({ status: "ok", message: "Conta suspensa." });
    } catch (err) {
        console.error("[CORPORATION] Erro ao suspender:", err);
        return handleDatabaseError(err, res, "Erro ao suspender funcionário");
    }
});

/** POST /staff/:referenciaID/reactivate — reactivar conta */
router.post("/staff/:referenciaID/reactivate", requirePermission("corporation.staff.manage", "PermissÃ£o insuficiente para gerir colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;
        const [r] = await pool.query(
            "UPDATE utilizadores SET Ativo = 1, DataDesativacao = NULL, UpdatedAt = NOW() WHERE ReferenciaID = ?",
            [referenciaID]
        );
        const affected = r.affectedRows !== undefined ? r.affectedRows : (r.rowCount || 0);
        if (!affected) {
            return res.status(404).json({ status: "error", error: "Utilizador não encontrado." });
        }
        logAudit(req, 'staff.reactivate', { targetType: 'user', targetId: referenciaID });
        res.json({ status: "ok", message: "Conta reactivada." });
    } catch (err) {
        console.error("[CORPORATION] Erro ao reactivar:", err);
        return handleDatabaseError(err, res, "Erro ao reactivar funcionário");
    }
});

/** POST /staff/:referenciaID/reset-password — gerar nova password temporária */
router.post("/staff/:referenciaID/reset-password", requirePermission("corporation.staff.manage", "PermissÃ£o insuficiente para gerir colaboradores."), async (req, res) => {
    try {
        const { referenciaID } = req.params;
        const [exists] = await pool.query(
            "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ?",
            [referenciaID]
        );
        if (exists.length === 0) {
            return res.status(404).json({ status: "error", error: "Utilizador não encontrado." });
        }
        const tempPassword = generateTempPassword();
        const hash = await bcrypt.hash(tempPassword, 10);
        await pool.query(
            "UPDATE utilizadores SET SenhaHash = ?, UltimaAlteracaoSenha = NOW(), UpdatedAt = NOW() WHERE ReferenciaID = ?",
            [hash, referenciaID]
        );
        logAudit(req, 'staff.reset_password', { targetType: 'user', targetId: referenciaID });
        res.json({
            status: "ok",
            message: "Password redefinida. Entrega esta password ao funcionário — não voltará a ser mostrada.",
            tempPassword
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao redefinir password:", err);
        return handleDatabaseError(err, res, "Erro ao redefinir password");
    }
});

/** Eventos do calendário (read-only) - mesma fonte que o admin */
router.get("/calendar/events", async (req, res) => {
    try {
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'admin_events'");
        if (tables.length === 0) {
            return res.json({ status: "ok", events: [] });
        }
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
                u.Nome as created_by_name
            FROM admin_events e
            LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy
            WHERE 1=1
        `;
        const params = [];
        if (start && end) {
            query += ` AND (
                (e.StartDate >= ? AND e.StartDate <= ?) OR
                (e.EndDate >= ? AND e.EndDate <= ?) OR
                (e.StartDate <= ? AND e.EndDate >= ?)
            )`;
            params.push(start, end, start, end, start, end);
        }
        query += " ORDER BY e.StartDate ASC";
        const [events] = await pool.query(query, params);
        const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description || '',
            type: event.type,
            start: event.start_date,
            end: event.end_date || null,
            status: event.status,
            createdBy: event.created_by,
            createdByName: event.created_by_name || 'Suporte',
            createdAt: event.created_at
        }));
        res.json({ status: "ok", events: formattedEvents });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar eventos:", err);
        return handleDatabaseError(err, res, "Erro ao buscar calendário");
    }
});

/** Garantir tabela de atividades (corporação -> suporte) */
async function ensureCorporationActivitiesTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS corporation_activities (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                DataInicio DATETIME NOT NULL,
                DuracaoMinutos INT NOT NULL DEFAULT 60,
                AssignedTo VARCHAR(13) NULL,
                TipoAtividade VARCHAR(80) NULL,
                Acao VARCHAR(255) NULL,
                Descricao TEXT NULL,
                Estado ENUM('pendente','em_curso','concluida','cancelada') DEFAULT 'pendente',
                CreatedBy VARCHAR(13) NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UpdatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_DataInicio (DataInicio),
                INDEX idx_AssignedTo (AssignedTo),
                INDEX idx_Estado (Estado),
                INDEX idx_CreatedBy (CreatedBy)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_comments (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                ActivityId INT NOT NULL,
                ReferenciaID VARCHAR(13) NULL,
                IsCorporation TINYINT(1) NOT NULL DEFAULT 0,
                Mensagem TEXT NOT NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ActivityId (ActivityId),
                FOREIGN KEY (ActivityId) REFERENCES corporation_activities(Id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_reports (
                Id INT AUTO_INCREMENT PRIMARY KEY,
                ActivityId INT NOT NULL,
                ReferenciaID VARCHAR(13) NULL,
                TextoRelatorio TEXT NULL,
                AnexoUrl VARCHAR(500) NULL,
                CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ActivityId (ActivityId),
                FOREIGN KEY (ActivityId) REFERENCES corporation_activities(Id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    } catch (e) {
        console.error("[CORPORATION] ensureCorporationActivitiesTable:", e.message);
    }
}

function mapStaffRow(row) {
    if (!row) return null;
    const ativoRaw = row.Ativo !== undefined ? row.Ativo : row.ativo;
    return {
        ReferenciaID: row.ReferenciaID || row.referenciaid || "",
        Nome: row.Nome || row.nome || "",
        Email: row.Email || row.email || "",
        Telefone: row.Telefone || row.telefone || "",
        DataRegisto: row.DataRegisto || row.dataregisto || null,
        PerfilId: row.PerfilId || row.perfilid || null,
        PerfilNome: row.PerfilNome || row.perfilnome || "",
        Ativo: ativoRaw === undefined ? null : Number(ativoRaw),
        DataDesativacao: row.DataDesativacao || row.datadesativacao || null,
        UltimoLogin: row.UltimoLogin || row.ultimologin || null,
    };
}

function mapNotificationRow(row) {
    if (!row) return null;
    return {
        Id: row.Id || row.id || null,
        Tipo: row.Tipo || row.tipo || "",
        Titulo: row.Titulo || row.titulo || "",
        Descricao: row.Descricao || row.descricao || "",
        ReferenciaID: row.ReferenciaID || row.referenciaid || row.author_id || row.authorid || null,
        DataCriacao: row.DataCriacao || row.datacriacao || null,
        author_nome: row.author_nome || row.author_nome || row.authornome || null,
        author_email: row.author_email || row.authoremail || null,
    };
}

function mapBugProjetoRow(row) {
    if (!row) return null;
    return {
        Id: row.Id || row.id || null,
        Titulo: row.Titulo || row.titulo || "",
        Tipo: row.Tipo || row.tipo || "",
        Prioridade: row.Prioridade || row.prioridade || "",
        Status: row.Status || row.status || "",
        DataCriacao: row.DataCriacao || row.datacriacao || null,
        author_id: row.author_id || row.authorid || null,
        author_nome: row.author_nome || row.authornome || null,
    };
}

function mapEventRow(row) {
    if (!row) return null;
    return {
        Id: row.Id || row.id || null,
        Titulo: row.Titulo || row.titulo || "",
        Tipo: row.Tipo || row.tipo || "",
        Status: row.Status || row.status || "",
        StartDate: row.StartDate || row.startdate || null,
        author_id: row.author_id || row.authorid || null,
        author_nome: row.author_nome || row.authornome || null,
    };
}

function mapCalendarEventRow(row) {
    if (!row) return null;
    return {
        Id: row.Id || row.id || null,
        Titulo: row.Titulo || row.titulo || "",
        Descricao: row.Descricao || row.descricao || "",
        Tipo: row.Tipo || row.tipo || "",
        Status: row.Status || row.status || "",
        StartDate: row.StartDate || row.startdate || null,
        EndDate: row.EndDate || row.enddate || null,
    };
}

/** GET /calendar/activities - atividades no intervalo (para calendário corporativo) */
router.get("/calendar/activities", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const { start, end } = req.query;
        let query = `
            SELECT a.Id, a.DataInicio, a.DuracaoMinutos, a.AssignedTo, a.TipoAtividade, a.Acao, a.Descricao, a.Estado, a.CreatedBy, a.CreatedAt,
                   u.Nome AS AssignedToNome
            FROM corporation_activities a
            LEFT JOIN utilizadores u ON u.ReferenciaID COLLATE utf8mb4_unicode_ci = a.AssignedTo
            WHERE 1=1
        `;
        const params = [];
        if (start && end) {
            query += " AND a.DataInicio >= ? AND a.DataInicio <= ?";
            params.push(start, end);
        }
        query += " ORDER BY a.DataInicio ASC";
        const [rows] = await pool.query(query, params);
        const activities = rows.map(r => {
            const dataFim = new Date(r.DataInicio);
            dataFim.setMinutes(dataFim.getMinutes() + (r.DuracaoMinutos || 0));
            return {
                id: r.Id,
                title: r.Acao || r.TipoAtividade || "Atividade",
                start: r.DataInicio,
                end: dataFim.toISOString().slice(0, 19).replace("T", " "),
                tipoAtividade: r.TipoAtividade,
                acao: r.Acao,
                descricao: r.Descricao,
                estado: r.Estado,
                assignedTo: r.AssignedTo,
                assignedToNome: r.AssignedToNome
            };
        });
        res.json({ status: "ok", activities });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar atividades:", err);
        return handleDatabaseError(err, res, "Erro ao buscar atividades");
    }
});

/** GET /calendar/activities/list - lista atividades por filtro: pendentes | nao_concluidas | concluidas */
router.get("/calendar/activities/list", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const { filter } = req.query;
        let query = `
            SELECT a.Id, a.DataInicio, a.DuracaoMinutos, a.AssignedTo, a.TipoAtividade, a.Acao, a.Descricao, a.Estado, a.CreatedBy, a.CreatedAt,
                   u.Nome AS AssignedToNome
            FROM corporation_activities a
            LEFT JOIN utilizadores u ON u.ReferenciaID COLLATE utf8mb4_unicode_ci = a.AssignedTo
            WHERE 1=1
        `;
        const params = [];
        if (filter === "pendentes") {
            query += " AND a.Estado IN ('pendente','em_curso') AND (a.DataInicio + a.DuracaoMinutos * INTERVAL '1 minute') >= NOW()";
        } else if (filter === "nao_concluidas") {
            query += " AND a.Estado IN ('pendente','em_curso')";
        } else if (filter === "concluidas") {
            query += " AND a.Estado = 'concluida'";
        }
        query += " ORDER BY a.DataInicio ASC";
        const [rows] = await pool.query(query, params);
        const activities = rows.map(r => {
            const dataFim = new Date(r.DataInicio);
            dataFim.setMinutes(dataFim.getMinutes() + (r.DuracaoMinutos || 0));
            return {
                id: r.Id,
                dataInicio: r.DataInicio,
                duracaoMinutos: r.DuracaoMinutos,
                dataFim: dataFim.toISOString(),
                assignedTo: r.AssignedTo,
                assignedToNome: r.AssignedToNome,
                tipoAtividade: r.TipoAtividade,
                acao: r.Acao,
                descricao: r.Descricao,
                estado: r.Estado,
                createdBy: r.CreatedBy,
                createdAt: r.CreatedAt
            };
        });
        res.json({ status: "ok", activities });
    } catch (err) {
        console.error("[CORPORATION] Erro ao listar atividades (filter):", err);
        return handleDatabaseError(err, res, "Erro ao listar atividades");
    }
});

/** GET /calendar/activities/:id - detalhe da atividade + comentários + relatórios (corporação) */
router.get("/calendar/activities/:id", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const [rows] = await pool.query(
            `SELECT a.Id, a.DataInicio, a.DuracaoMinutos, a.AssignedTo, a.TipoAtividade, a.Acao, a.Descricao, a.Estado, a.CreatedBy, a.CreatedAt, a.UpdatedAt,
                    u.Nome AS AssignedToNome
             FROM corporation_activities a
             LEFT JOIN utilizadores u ON u.ReferenciaID COLLATE utf8mb4_unicode_ci = a.AssignedTo
             WHERE a.Id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ status: "error", error: "Atividade não encontrada" });
        const act = rows[0];
        const dataFim = new Date(act.DataInicio);
        dataFim.setMinutes(dataFim.getMinutes() + (act.DuracaoMinutos || 0));
        const [comments] = await pool.query(
            "SELECT Id, ActivityId, ReferenciaID, IsCorporation, Mensagem, CreatedAt FROM activity_comments WHERE ActivityId = ? ORDER BY CreatedAt ASC",
            [req.params.id]
        ).catch(() => [[]]);
        const [reports] = await pool.query(
            "SELECT Id, ActivityId, ReferenciaID, TextoRelatorio, AnexoUrl, CreatedAt FROM activity_reports WHERE ActivityId = ? ORDER BY CreatedAt DESC",
            [req.params.id]
        ).catch(() => [[]]);
        res.json({
            status: "ok",
            activity: {
                id: act.Id,
                dataInicio: act.DataInicio,
                duracaoMinutos: act.DuracaoMinutos,
                dataFim: dataFim.toISOString(),
                assignedTo: act.AssignedTo,
                assignedToNome: act.AssignedToNome,
                tipoAtividade: act.TipoAtividade,
                acao: act.Acao,
                descricao: act.Descricao,
                estado: act.Estado,
                createdBy: act.CreatedBy,
                createdAt: act.CreatedAt,
                updatedAt: act.UpdatedAt
            },
            comments: comments || [],
            reports: reports || []
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar detalhe atividade:", err);
        return handleDatabaseError(err, res, "Erro ao buscar atividade");
    }
});

/** POST /calendar/activities - criar atividade (corporação) */
router.post("/calendar/activities", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const referenciaID = req.user && req.user.ReferenciaID;
        const { dataInicio, duracaoMinutos, assignedTo, tipoAtividade, acao, descricao } = req.body;
        if (!dataInicio) {
            return res.status(400).json({ status: "error", error: "Data/hora de início obrigatória" });
        }
        const duration = Math.max(1, parseInt(duracaoMinutos) || 60);
        const [result] = await pool.query(
            `INSERT INTO corporation_activities (DataInicio, DuracaoMinutos, AssignedTo, TipoAtividade, Acao, Descricao, CreatedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                dataInicio.replace("T", " ").slice(0, 19),
                duration,
                assignedTo || null,
                tipoAtividade || null,
                acao || null,
                descricao || null,
                referenciaID || null
            ]
        );
        const [row] = await pool.query(
            `SELECT a.Id, a.DataInicio, a.DuracaoMinutos, a.AssignedTo, a.TipoAtividade, a.Acao, a.Descricao, a.Estado, a.CreatedAt,
                    u.Nome AS AssignedToNome
             FROM corporation_activities a
             LEFT JOIN utilizadores u ON u.ReferenciaID COLLATE utf8mb4_unicode_ci = a.AssignedTo
             WHERE a.Id = ?`,
            [result.insertId]
        );
        const r = row[0];
        const dataFim = new Date(r.DataInicio);
        dataFim.setMinutes(dataFim.getMinutes() + (r.DuracaoMinutos || 0));
        logAudit(req, 'activity.create', {
            targetType: 'activity',
            targetId: r.Id,
            details: { assignedTo: r.AssignedTo, tipo: r.TipoAtividade, acao: r.Acao }
        });
        res.status(201).json({
            status: "ok",
            activity: {
                id: r.Id,
                dataInicio: r.DataInicio,
                duracaoMinutos: r.DuracaoMinutos,
                dataFim: dataFim.toISOString(),
                assignedTo: r.AssignedTo,
                assignedToNome: r.AssignedToNome,
                tipoAtividade: r.TipoAtividade,
                acao: r.Acao,
                descricao: r.Descricao,
                estado: r.Estado,
                createdAt: r.CreatedAt
            }
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao criar atividade:", err);
        return handleDatabaseError(err, res, "Erro ao criar atividade");
    }
});

/** PUT /calendar/activities/:id - atualizar atividade (corporação) */
router.put("/calendar/activities/:id", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const { dataInicio, duracaoMinutos, assignedTo, tipoAtividade, acao, descricao } = req.body;
        const id = req.params.id;
        const [ex] = await pool.query("SELECT Id FROM corporation_activities WHERE Id = ?", [id]);
        if (ex.length === 0) return res.status(404).json({ status: "error", error: "Atividade não encontrada" });
        const updates = [];
        const values = [];
        if (dataInicio !== undefined) { updates.push("DataInicio = ?"); values.push(dataInicio.replace("T", " ").slice(0, 19)); }
        if (duracaoMinutos !== undefined) { updates.push("DuracaoMinutos = ?"); values.push(Math.max(1, parseInt(duracaoMinutos) || 60)); }
        if (assignedTo !== undefined) { updates.push("AssignedTo = ?"); values.push(assignedTo || null); }
        if (tipoAtividade !== undefined) { updates.push("TipoAtividade = ?"); values.push(tipoAtividade || null); }
        if (acao !== undefined) { updates.push("Acao = ?"); values.push(acao || null); }
        if (descricao !== undefined) { updates.push("Descricao = ?"); values.push(descricao || null); }
        if (updates.length === 0) return res.json({ status: "ok", message: "Nada a atualizar" });
        values.push(id);
        await pool.query(`UPDATE corporation_activities SET ${updates.join(", ")} WHERE Id = ?`, values);
        logAudit(req, 'activity.update', {
            targetType: 'activity',
            targetId: id,
            details: { fields: updates.map(u => u.split(' = ')[0]) }
        });
        res.json({ status: "ok", message: "Atividade atualizada" });
    } catch (err) {
        console.error("[CORPORATION] Erro ao atualizar atividade:", err);
        return handleDatabaseError(err, res, "Erro ao atualizar atividade");
    }
});

/** DELETE /calendar/activities/:id - remover atividade (corporação) */
router.delete("/calendar/activities/:id", async (req, res) => {
    try {
        await ensureCorporationActivitiesTable();
        const [r] = await pool.query("DELETE FROM corporation_activities WHERE Id = ?", [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ status: "error", error: "Atividade não encontrada" });
        logAudit(req, 'activity.delete', { targetType: 'activity', targetId: req.params.id });
        res.json({ status: "ok", message: "Atividade removida" });
    } catch (err) {
        console.error("[CORPORATION] Erro ao remover atividade:", err);
        return handleDatabaseError(err, res, "Erro ao remover atividade");
    }
});

/** POST /calendar/activities/:id/comments - comentário da corporação */
router.post("/calendar/activities/:id/comments", async (req, res) => {
    try {
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'activity_comments'");
        if (tables.length === 0) return res.status(404).json({ status: "error", error: "Tabela não existe" });
        const referenciaID = req.user && req.user.ReferenciaID;
        const { mensagem } = req.body;
        if (!mensagem || !String(mensagem).trim()) return res.status(400).json({ status: "error", error: "Mensagem obrigatória" });
        const [check] = await pool.query("SELECT Id FROM corporation_activities WHERE Id = ?", [req.params.id]);
        if (check.length === 0) return res.status(404).json({ status: "error", error: "Atividade não encontrada" });
        await pool.query(
            "INSERT INTO activity_comments (ActivityId, ReferenciaID, IsCorporation, Mensagem) VALUES (?, ?, 1, ?)",
            [req.params.id, referenciaID || null, String(mensagem).trim()]
        );
        res.json({ status: "ok", message: "Comentário adicionado" });
    } catch (err) {
        console.error("[CORPORATION] Erro ao adicionar comentário:", err);
        return handleDatabaseError(err, res, "Erro ao adicionar comentário");
    }
});

/** Avaliações (reviews) - com suporte que fechou quando tipo = suporte */
router.get("/reviews", async (req, res) => {
    try {
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'reviews'");
        if (tables.length === 0) {
            return res.json({ status: "ok", reviews: [], total: 0, stats: [] });
        }
        const tipo = req.query.tipo;
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const offset = (page - 1) * limit;

        const columns = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'reviews'"
        ).then(([c]) => c.map(x => x.column_name));
        const hasSupportRef = columns.some(c => c.toLowerCase() === 'supportreferenciaid');

        let query = `
            SELECT 
                r.Id,
                r.ReferenciaID,
                r.Tipo as tipo,
                r.Texto as texto,
                r.Rating as rating,
                CASE WHEN r.IsAnonimo = 1 THEN 1 ELSE 0 END as is_anonimo,
                r.CreatedAt as created_at,
                u.Nome as user_nome,
                u.Email as user_email
                ${hasSupportRef ? ", r.SupportReferenciaID, s.Nome as support_nome, s.Email as support_email" : ""}
            FROM reviews r
            LEFT JOIN utilizadores u ON r.ReferenciaID = u.ReferenciaID
            ${hasSupportRef ? "LEFT JOIN utilizadores s ON r.SupportReferenciaID = s.ReferenciaID" : ""}
            WHERE 1=1
        `;
        const params = [];
        if (tipo) {
            query += " AND r.Tipo = ?";
            params.push(tipo);
        }
        query += " ORDER BY r.CreatedAt DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const [reviews] = await pool.query(query, params);

        let countQuery = "SELECT COUNT(*) as total FROM reviews WHERE 1=1";
        const countParams = tipo ? [tipo] : [];
        if (tipo) countQuery += " AND Tipo = ?";
        const [[{ total }]] = await pool.query(countQuery, countParams);

        const [statsResult] = await pool.query(`
            SELECT Tipo as tipo, COUNT(*) as total, AVG(Rating) as media_rating
            FROM reviews WHERE Rating IS NOT NULL GROUP BY Tipo
        `).catch(() => [[]]);

        res.json({
            status: "ok",
            reviews,
            total: total || 0,
            page,
            limit,
            totalPages: Math.ceil((total || 0) / limit),
            stats: statsResult
        });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar avaliações:", err);
        return handleDatabaseError(err, res, "Erro ao buscar avaliações");
    }
});

/** Dashboard: incidentes, atualizações sistema, bugs/projetos e eventos recentes */
router.get("/dashboard", async (req, res) => {
    try {
        const limit = 15;
        const out = { notifications: [], atualizacoesSistema: [], recentBugsProjetos: [], recentEvents: [] };

        const [hasNotif] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'corporation_notifications'");
        if (hasNotif.length > 0) {
            const [notifications] = await pool.query(
                `SELECT n.Id, n.Tipo, n.Titulo, n.Descricao, n.ReferenciaID as author_id, n.DataCriacao,
                        u.Nome as author_nome
                 FROM corporation_notifications n
                 LEFT JOIN utilizadores u ON n.ReferenciaID COLLATE utf8mb4_unicode_ci = u.ReferenciaID
                 ORDER BY n.DataCriacao DESC LIMIT ?`,
                [limit]
            );
            out.notifications = (notifications || []).map(mapNotificationRow);
        }

        const [hasAtualizacoes] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'atualizacoes_sistema'");
        if (hasAtualizacoes.length > 0) {
            const [rows] = await pool.query(
                `SELECT Id, Titulo, Descricao, Tipo, DataCriacao
                 FROM atualizacoes_sistema
                 ORDER BY DataCriacao DESC LIMIT ?`,
                [limit]
            );
            out.atualizacoesSistema = (rows || []).map((row) => ({
                Id: row.Id || row.id || null,
                Titulo: row.Titulo || row.titulo || "",
                Descricao: row.Descricao || row.descricao || "",
                Tipo: row.Tipo || row.tipo || "",
                DataCriacao: row.DataCriacao || row.datacriacao || null,
            }));
        }

        const [hasBugsTable] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'bugsprojetos'");
        if (hasBugsTable.length > 0) {
            const [hasCol] = await pool.query(
                "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bugsprojetos' AND COLUMN_NAME = 'CreatedBy'"
            );
            if (hasCol.length > 0) {
                const [bugs] = await pool.query(
                    `SELECT b.Id, b.Titulo, b.Tipo, b.Prioridade, b.Status, b.DataCriacao, b.CreatedBy as author_id, u.Nome as author_nome
                     FROM bugsprojetos b
                     LEFT JOIN utilizadores u ON u.ReferenciaID = b.CreatedBy
                     ORDER BY b.DataCriacao DESC LIMIT ?`,
                    [limit]
                );
                out.recentBugsProjetos = (bugs || []).map(mapBugProjetoRow);
            } else {
                const [bugs] = await pool.query(
                    `SELECT Id, Titulo, Tipo, Prioridade, Status, DataCriacao
                     FROM bugsprojetos
                     ORDER BY DataCriacao DESC LIMIT ?`,
                    [limit]
                );
                out.recentBugsProjetos = (bugs || []).map((b) => ({
                    ...mapBugProjetoRow(b),
                    author_id: null,
                    author_nome: null
                }));
            }
        }

        const [hasEvents] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'admin_events'");
        if (hasEvents.length > 0) {
            const [events] = await pool.query(
                `SELECT e.Id, e.Titulo, e.Tipo, e.Status, e.StartDate, e.CreatedBy as author_id, u.Nome as author_nome
                 FROM admin_events e
                 LEFT JOIN utilizadores u ON u.ReferenciaID = e.CreatedBy COLLATE utf8mb4_unicode_ci
                 ORDER BY e.StartDate DESC LIMIT ?`,
                [limit]
            );
            out.recentEvents = (events || []).map(mapEventRow);
        }

        res.json({ status: "ok", ...out });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar dashboard:", err);
        return handleDatabaseError(err, res, "Erro ao carregar dashboard");
    }
});

/** Notificações do painel corporativo (atualizações/incidentes) */
router.get("/notifications", async (req, res) => {
    try {
        const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'corporation_notifications'");
        if (tables.length === 0) {
            return res.json({ status: "ok", notifications: [] });
        }
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const [notifications] = await pool.query(
            `SELECT n.Id, n.Tipo, n.Titulo, n.Descricao, n.ReferenciaID as author_id, n.DataCriacao,
                    u.Nome as author_nome, u.Email as author_email
             FROM corporation_notifications n
             LEFT JOIN utilizadores u ON n.ReferenciaID COLLATE utf8mb4_unicode_ci = u.ReferenciaID
             ORDER BY n.DataCriacao DESC LIMIT ?`,
            [limit]
        );
        res.json({ status: "ok", notifications: (notifications || []).map(mapNotificationRow) });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar notificações:", err);
        return handleDatabaseError(err, res, "Erro ao buscar notificações");
    }
});

router.get("/discord/requests", async (req, res) => {
    try {
        await ensureCorporationDiscordCouponTables();

        const status = String(req.query.status || "pending").trim();
        const [rows] = await pool.query(
            `SELECT r.id, r.requested_by_referenciaid, r.target_guild_id, r.target_channel_id,
                    r.title, r.description, r.color, r.image_url, r.button_label, r.button_url, r.coupon_code,
                    r.status, r.review_note, r.created_at, r.reviewed_at,
                    u.Nome AS requester_name, u.Email AS requester_email
               FROM discord_coupon_requests r
               LEFT JOIN utilizadores u ON u.ReferenciaID = r.requested_by_referenciaid
              WHERE r.status = ?
              ORDER BY r.created_at DESC
              LIMIT 100`,
            [status]
        );

        res.json({ status: "ok", requests: rows || [] });
    } catch (err) {
        console.error("[CORPORATION] Erro ao listar pedidos Discord:", err);
        return handleDatabaseError(err, res, "Erro ao listar pedidos Discord");
    }
});

router.post("/discord/requests/:id/approve", async (req, res) => {
    try {
        await ensureCorporationDiscordCouponTables();
        await ensureCorporationDiscordGuildsTable();

        const id = parseInt(req.params.id, 10);
        if (!id) {
            return res.status(400).json({ status: "error", error: "ID invalido" });
        }

        const [reqRows] = await pool.query(
            `SELECT * FROM discord_coupon_requests WHERE id = ? AND status = 'pending' LIMIT 1`,
            [id]
        );
        if (!reqRows || reqRows.length === 0) {
            return res.status(404).json({ status: "error", error: "Solicitacao nao encontrada ou ja revista" });
        }

        const requestRow = reqRows[0];
        const [botRows] = await pool.query(
            `SELECT 1 FROM corporation_discord_guilds WHERE guild_id = ? AND removed_at IS NULL LIMIT 1`,
            [requestRow.target_guild_id]
        );
        if (!botRows || botRows.length === 0) {
            return res.status(400).json({ status: "error", error: "Bot nao esta mais no servidor alvo" });
        }

        const payload = {
            guild_id: requestRow.target_guild_id,
            channel_id: requestRow.target_channel_id,
            title: requestRow.title,
            description: requestRow.description,
            color: requestRow.color,
            image_url: requestRow.image_url,
            button_label: requestRow.button_label,
            button_url: requestRow.button_url,
            coupon_code: requestRow.coupon_code
        };

        const [msgIns] = await pool.query(
            `INSERT INTO discord_coupon_messages
                (sent_by_referenciaid, guild_id, channel_id, title, description, color, image_url, button_label, button_url, coupon_code, request_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`,
            [
                req.user.ReferenciaID,
                requestRow.target_guild_id,
                requestRow.target_channel_id,
                requestRow.title,
                requestRow.description,
                requestRow.color,
                requestRow.image_url,
                requestRow.button_label,
                requestRow.button_url,
                requestRow.coupon_code,
                id
            ]
        );
        const messageRowId = msgIns?.insertId || msgIns?.rows?.[0]?.id || msgIns?.rows?.[0]?.Id;
        if (!messageRowId) {
            throw new Error("Falha ao obter ID da mensagem Discord aprovada");
        }

        await pool.query(
            `INSERT INTO discord_outbound_queue (guild_id, channel_id, payload, coupon_message_id)
             VALUES (?, ?, ?::jsonb, ?)`,
            [requestRow.target_guild_id, requestRow.target_channel_id, JSON.stringify(payload), messageRowId]
        );

        await pool.query(
            `UPDATE discord_coupon_requests
                SET status = 'approved',
                    reviewed_by_referenciaid = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    review_note = ?
              WHERE id = ?`,
            [req.user.ReferenciaID, req.body.note || null, id]
        );

        logAudit(req, 'discord.approve', {
            targetType: 'discord_coupon_request',
            targetId: id,
            details: { guild_id: requestRow.target_guild_id, channel_id: requestRow.target_channel_id, message_row_id: messageRowId }
        });
        res.json({ status: "ok", ok: true, message_row_id: messageRowId });
    } catch (err) {
        console.error("[CORPORATION] Erro ao aprovar pedido Discord:", err);
        return handleDatabaseError(err, res, "Erro ao aprovar pedido Discord");
    }
});

router.post("/discord/requests/:id/reject", async (req, res) => {
    try {
        await ensureCorporationDiscordCouponTables();

        const id = parseInt(req.params.id, 10);
        if (!id) {
            return res.status(400).json({ status: "error", error: "ID invalido" });
        }

        const [upd] = await pool.query(
            `UPDATE discord_coupon_requests
                SET status = 'rejected',
                    reviewed_by_referenciaid = ?,
                    reviewed_at = CURRENT_TIMESTAMP,
                    review_note = ?
              WHERE id = ? AND status = 'pending'`,
            [req.user.ReferenciaID, req.body.note || null, id]
        );
        const affected = upd.affectedRows !== undefined ? upd.affectedRows : (upd.rowCount || 0);
        if (!affected) {
            return res.status(404).json({ status: "error", error: "Solicitacao nao encontrada ou ja revista" });
        }

        logAudit(req, 'discord.reject', {
            targetType: 'discord_coupon_request',
            targetId: id,
            details: { note: req.body.note || null }
        });
        res.json({ status: "ok", ok: true });
    } catch (err) {
        console.error("[CORPORATION] Erro ao rejeitar pedido Discord:", err);
        return handleDatabaseError(err, res, "Erro ao rejeitar pedido Discord");
    }
});

/** GET /api/corporation/bugs - lista bugs/projetos (read-only) */
router.get("/bugs", async (req, res) => {
    try {
        if (!(await tableExists("bugsprojetos"))) {
            return res.json({ status: "ok", bugs: [], total: 0 });
        }
        const hasCreatedBy = await columnExists("bugsprojetos", "CreatedBy");
        let bugs = [];
        if (hasCreatedBy) {
            const [rows] = await pool.query(
                `SELECT b.Id AS "Id", b.Titulo AS "Titulo", b.Descricao AS "Descricao",
                        b.Tipo AS "Tipo", b.Prioridade AS "Prioridade", b.Status AS "Status",
                        b.AnexoUrl AS "AnexoUrl", b.CreatedBy AS "author_id", u.Nome AS "author_nome",
                        b.DataCriacao AS "DataCriacao", b.DataAtualizacao AS "DataAtualizacao"
                 FROM bugsprojetos b
                 LEFT JOIN utilizadores u ON u.ReferenciaID = b.CreatedBy
                 ORDER BY b.DataCriacao DESC LIMIT 200`
            );
            bugs = rows;
        } else {
            const [rows] = await pool.query(
                `SELECT Id AS "Id", Titulo AS "Titulo", Descricao AS "Descricao",
                        Tipo AS "Tipo", Prioridade AS "Prioridade", Status AS "Status",
                        AnexoUrl AS "AnexoUrl",
                        DataCriacao AS "DataCriacao", DataAtualizacao AS "DataAtualizacao"
                 FROM bugsprojetos
                 ORDER BY DataCriacao DESC LIMIT 200`
            );
            bugs = rows;
        }
        res.json({ status: "ok", bugs, total: bugs.length });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar bugs:", err);
        return handleDatabaseError(err, res, "Erro ao buscar bugs");
    }
});

/** GET /api/corporation/sugestoes - lista sugestões (read-only) */
router.get("/sugestoes", async (req, res) => {
    try {
        if (!(await tableExists("sugestoes"))) {
            return res.json({ status: "ok", sugestoes: [], total: 0 });
        }
        const [rows] = await pool.query(
            `SELECT Id AS "Id", Titulo AS "Titulo", Descricao AS "Descricao",
                    Plataforma AS "Plataforma", Prioridade AS "Prioridade", Status AS "Status",
                    Votos AS "Votos",
                    DataCriacao AS "DataCriacao", DataAtualizacao AS "DataAtualizacao"
             FROM sugestoes
             ORDER BY DataCriacao DESC LIMIT 200`
        );
        res.json({ status: "ok", sugestoes: rows, total: rows.length });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar sugestões:", err);
        return handleDatabaseError(err, res, "Erro ao buscar sugestões");
    }
});

/** GET /api/corporation/incidents - lista incidentes (read-only) */
router.get("/incidents", async (req, res) => {
    try {
        if (!(await tableExists("incidentes"))) {
            return res.json({ status: "ok", incidents: [], total: 0 });
        }
        const hasDataCriacao = await columnExists("incidentes", "DataCriacao");
        const dataCriacaoExpr = hasDataCriacao ? "DataCriacao" : "CreatedAt";
        const dataAtualizacaoExpr = hasDataCriacao ? "DataAtualizacao" : "UpdatedAt";
        const [rows] = await pool.query(
            `SELECT Id AS "Id", Titulo AS "Titulo", Descricao AS "Descricao",
                    ComponenteAfetado AS "ComponenteAfetado", Status AS "Status",
                    DataInicio AS "DataInicio", DataFim AS "DataFim",
                    Duracao AS "Duracao", Impacto AS "Impacto",
                    ${dataCriacaoExpr} AS "DataCriacao", ${dataAtualizacaoExpr} AS "DataAtualizacao"
             FROM incidentes
             ORDER BY DataInicio DESC LIMIT 200`
        );
        res.json({ status: "ok", incidents: rows, total: rows.length });
    } catch (err) {
        console.error("[CORPORATION] Erro ao buscar incidentes:", err);
        return handleDatabaseError(err, res, "Erro ao buscar incidentes");
    }
});

export default router;
