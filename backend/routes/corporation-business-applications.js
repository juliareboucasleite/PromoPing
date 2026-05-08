import express from "express";
import { pool } from "../database/db.js";
import { ensureBusinessTablesReady } from "../services/businessSchema.service.js";
import { sendEmail } from "../services/notify.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

router.use(async (req, res, next) => {
  try {
    await ensureBusinessTablesReady();
    next();
  } catch (error) {
    console.error("[CORPORATION] Erro ao garantir schema business:", error);
    res.status(500).json({ status: "error", error: "Erro ao preparar schema business." });
  }
});

const DEFAULT_REJECTION_NOTE =
  "O pedido business foi recusado apos revisao interna. Pode responder a este email com mais detalhes ou corrigir os dados e submeter um novo pedido.";

function getPublicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || process.env.BASE_URL || "https://promoping.pt").replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyOrganizationName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

function normalizeStatus(status) {
  const normalized = String(status || "pending").trim().toLowerCase();
  return ["pending", "approved", "rejected", "all"].includes(normalized)
    ? normalized
    : "pending";
}

function mapApplicationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    referenciaID: row.referenciaid,
    applicant: {
      nome: row.applicant_name,
      email: row.applicant_email,
      telefone: row.applicant_phone
    },
    company: {
      nomeEmpresa: row.nome_empresa,
      nif: row.nif,
      vatNumber: row.vat_number,
      website: row.website,
      setor: row.setor,
      categoria: row.categoria,
      pessoaResponsavel: row.pessoa_responsavel,
      telefoneComercial: row.telefone_comercial,
      billingEmail: row.billing_email,
      morada: {
        linha1: row.morada_linha1,
        linha2: row.morada_linha2,
        cidade: row.cidade,
        codigoPostal: row.codigo_postal,
        pais: row.pais
      },
      logoUrl: row.logo_url
    },
    requestedPlanName: row.requested_plan_name,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by_referenciaid
      ? {
          referenciaID: row.reviewed_by_referenciaid,
          nome: row.reviewer_name || null,
          email: row.reviewer_email || null
        }
      : null,
    approvedOrganizationId: row.approved_organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getPlanByName(name, connection = pool) {
  const [rows] = await connection.query(
    `SELECT Id, Nome, LimiteProdutos
       FROM planos
      WHERE Nome = ?
      LIMIT 1`,
    [name]
  );
  return rows[0] || null;
}

async function ensureUserConfig(referenciaID, planId, limiteProdutos, connection) {
  const [existing] = await connection.query(
    `SELECT Id
       FROM configutilizador
      WHERE ReferenciaID = ?
      LIMIT 1`,
    [referenciaID]
  );

  if (existing.length > 0) {
    await connection.query(
      `UPDATE configutilizador
          SET PlanoAtualId = ?,
              LimiteProdutos = ?,
              CanalPreferido = COALESCE(CanalPreferido, 'email')
        WHERE ReferenciaID = ?`,
      [planId, limiteProdutos, referenciaID]
    );
    return;
  }

  await connection.query(
    `INSERT INTO configutilizador (ReferenciaID, PlanoAtualId, LimiteProdutos, CanalPreferido)
     VALUES (?, ?, ?, ?)`,
    [referenciaID, planId, limiteProdutos, "email"]
  );
}

async function generateUniqueSlug(nomeEmpresa, connection) {
  const base = slugifyOrganizationName(nomeEmpresa) || `empresa-${Date.now()}`;
  let candidate = base;
  let suffix = 1;

  while (true) {
    const [rows] = await connection.query(
      `SELECT id
         FROM organizations
        WHERE slug = ?
        LIMIT 1`,
      [candidate]
    );

    if (rows.length === 0) return candidate;

    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

async function sendDecisionEmail(application, decision, reviewNote) {
  const recipients = Array.from(
    new Set(
      [application.applicant_email, application.billing_email]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
  if (!recipients.length) return;

  const companyName = application.nome_empresa || "a sua empresa";
  const applicantName = application.applicant_name || "equipa";
  const planName = application.requested_plan_name || "Corporate";
  const applicantEmail = String(application.applicant_email || application.billing_email || "").trim();
  const baseUrl = getPublicBaseUrl();
  const businessLoginUrl = `${baseUrl}/business/create/login?approved=1&email=${encodeURIComponent(applicantEmail)}`;
  const businessDashboardUrl = `${baseUrl}/business/dashboard`;
  const forgotPasswordUrl = `${baseUrl}/inc/forgot-password.html`;

  if (decision === "approved") {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
        <h2>Bem-vindo ao painel business da PromoPing</h2>
        <p>Ola ${applicantName},</p>
        <p>O pedido business da empresa <strong>${companyName}</strong> foi aprovado.</p>
        <p>O plano atribuido ficou definido como <strong>${planName}</strong>.</p>
        <p>Ja pode entrar com a conta registada e continuar a configuracao da area business.</p>
        <div style="margin: 24px 0; padding: 20px; border: 1px solid #ececec; border-radius: 12px; background: #fafafa;">
          <p style="margin: 0 0 8px;"><strong>Email de acesso:</strong> ${escapeHtml(applicantEmail)}</p>
          <p style="margin: 0 0 8px;"><strong>Pagina de login:</strong> <a href="${businessLoginUrl}">${businessLoginUrl}</a></p>
          <p style="margin: 0;"><strong>Painel business:</strong> <a href="${businessDashboardUrl}">${businessDashboardUrl}</a></p>
        </div>
        <p>Por seguranca, a password nao e enviada por email. Use a password definida no registo da conta business.</p>
        <p>Se nao se lembrar da password, pode redefini-la aqui: <a href="${forgotPasswordUrl}">${forgotPasswordUrl}</a></p>
        ${
          reviewNote
            ? `<p><strong>Nota da revisao:</strong><br>${escapeHtml(reviewNote).replace(/\n/g, "<br>")}</p>`
            : ""
        }
        <p style="color: #666;">PromoPing</p>
      </div>
    `;

    await sendEmail(recipients.join(", "), "PromoPing Business - acesso aprovado", html);
    return;
  }

  const finalNote = reviewNote || DEFAULT_REJECTION_NOTE;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
      <h2>Pedido business recusado</h2>
      <p>Ola ${applicantName},</p>
      <p>O pedido business da empresa <strong>${companyName}</strong> nao foi aprovado nesta revisao.</p>
      <p><strong>Motivo:</strong><br>${escapeHtml(finalNote).replace(/\n/g, "<br>")}</p>
      <p>Pode responder a este email com contexto adicional ou submeter um novo pedido apos corrigir os dados.</p>
      <p style="color: #666;">PromoPing</p>
    </div>
  `;

  await sendEmail(recipients.join(", "), "PromoPing - Pedido business recusado", html);
}

router.get("/", async (req, res) => {
  const status = normalizeStatus(req.query.status);

  try {
    const params = [];
    let whereClause = "";

    if (status !== "all") {
      whereClause = "WHERE a.status = ?";
      params.push(status);
    }

    const [rows] = await pool.query(
      `SELECT
          a.*,
          reviewer.Nome AS reviewer_name,
          reviewer.Email AS reviewer_email
         FROM business_applications a
         LEFT JOIN utilizadores reviewer ON reviewer.ReferenciaID = a.reviewed_by_referenciaid
         ${whereClause}
         ORDER BY
           CASE a.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
           a.created_at DESC`,
      params
    );

    const [countRows] = await pool.query(
      `SELECT status, COUNT(*)::int AS total
         FROM business_applications
        GROUP BY status`
    );

    const counts = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const row of countRows) {
      const key = String(row.status || "").toLowerCase();
      if (key in counts) counts[key] = Number(row.total || 0);
      counts.total += Number(row.total || 0);
    }

    res.json({
      status: "ok",
      filter: status,
      counts,
      applications: rows.map(mapApplicationRow)
    });
  } catch (error) {
    console.error("[CORPORATION] Erro ao listar pedidos business:", error);
    res.status(500).json({
      status: "error",
      error: "Erro ao listar pedidos business."
    });
  }
});

router.post("/:id/approve", async (req, res) => {
  const applicationId = Number.parseInt(req.params.id || "", 10);
  const reviewNote = String(req.body?.reviewNote || "").trim() || null;

  if (!applicationId) {
    return res.status(400).json({ status: "error", error: "ID invalido." });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [applicationRows] = await connection.query(
      `SELECT *
         FROM business_applications
        WHERE id = ?
          AND status = 'pending'
        LIMIT 1`,
      [applicationId]
    );

    if (applicationRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        status: "error",
        error: "Pedido business nao encontrado ou ja revisto."
      });
    }

    const application = applicationRows[0];

    const [existingMembershipRows] = await connection.query(
      `SELECT id
         FROM organization_members
        WHERE referenciaid = ?
          AND status = 'active'
        LIMIT 1`,
      [application.referenciaid]
    );

    if (existingMembershipRows.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(409).json({
        status: "error",
        error: "Este utilizador ja pertence a uma organizacao business."
      });
    }

    const requestedPlan =
      (await getPlanByName(application.requested_plan_name, connection)) ||
      (await getPlanByName("Corporate", connection));

    if (!requestedPlan) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        status: "error",
        error: "Plano Corporate nao encontrado."
      });
    }

    const slug = await generateUniqueSlug(application.nome_empresa, connection);

    const [organizationResult] = await connection.query(
      `INSERT INTO organizations (
          slug,
          nome_empresa,
          nif,
          vat_number,
          website,
          setor,
          categoria,
          pessoa_responsavel,
          telefone_comercial,
          billing_email,
          morada_linha1,
          morada_linha2,
          cidade,
          codigo_postal,
          pais,
          logo_url,
          plano_atual_id,
          owner_referenciaid
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        slug,
        application.nome_empresa,
        application.nif || null,
        application.vat_number || null,
        application.website || null,
        application.setor || null,
        application.categoria || null,
        application.pessoa_responsavel || null,
        application.telefone_comercial || null,
        application.billing_email || null,
        application.morada_linha1 || null,
        application.morada_linha2 || null,
        application.cidade || null,
        application.codigo_postal || null,
        application.pais || null,
        application.logo_url || null,
        requestedPlan.Id,
        application.referenciaid
      ]
    );

    const organization = organizationResult.rows?.[0];
    if (!organization?.id) {
      throw new Error("Falha ao criar organizacao business.");
    }

    await connection.query(
      `INSERT INTO organization_members (organization_id, referenciaid, role, status)
       VALUES (?, ?, 'owner', 'active')`,
      [organization.id, application.referenciaid]
    );

    await connection.query(
      `UPDATE utilizadores
          SET PerfilId = 4
        WHERE ReferenciaID = ?`,
      [application.referenciaid]
    );

    await ensureUserConfig(
      application.referenciaid,
      requestedPlan.Id,
      requestedPlan.LimiteProdutos ?? 500,
      connection
    );

    await connection.query(
      `UPDATE business_applications
          SET status = 'approved',
              review_note = ?,
              reviewed_by_referenciaid = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              approved_organization_id = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [reviewNote, req.user.ReferenciaID, organization.id, applicationId]
    );

    await connection.commit();
    connection.release();

    try {
      await sendDecisionEmail(application, "approved", reviewNote);
    } catch (emailError) {
      console.error("[CORPORATION] Erro ao enviar email de aprovacao business:", emailError);
    }

    await logAudit(req, "business_application.approve", {
      targetType: "business_application",
      targetId: applicationId,
      details: {
        applicantReferenciaID: application.referenciaid,
        approvedOrganizationId: organization.id,
        requestedPlanName: application.requested_plan_name || "Corporate"
      }
    });

    res.json({
      status: "ok",
      message: "Pedido business aprovado com sucesso.",
      organizationId: organization.id
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}
    connection.release();
    console.error("[CORPORATION] Erro ao aprovar pedido business:", error);
    res.status(500).json({
      status: "error",
      error: "Erro ao aprovar pedido business."
    });
  }
});

router.post("/:id/reject", async (req, res) => {
  const applicationId = Number.parseInt(req.params.id || "", 10);
  const reviewNote = String(req.body?.reviewNote || "").trim() || DEFAULT_REJECTION_NOTE;

  if (!applicationId) {
    return res.status(400).json({ status: "error", error: "ID invalido." });
  }

  try {
    const [applicationRows] = await pool.query(
      `SELECT *
         FROM business_applications
        WHERE id = ?
          AND status = 'pending'
        LIMIT 1`,
      [applicationId]
    );

    if (applicationRows.length === 0) {
      return res.status(404).json({
        status: "error",
        error: "Pedido business nao encontrado ou ja revisto."
      });
    }

    const application = applicationRows[0];

    await pool.query(
      `UPDATE business_applications
          SET status = 'rejected',
              review_note = ?,
              reviewed_by_referenciaid = ?,
              reviewed_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [reviewNote, req.user.ReferenciaID, applicationId]
    );

    try {
      await sendDecisionEmail(application, "rejected", reviewNote);
    } catch (emailError) {
      console.error("[CORPORATION] Erro ao enviar email de recusa business:", emailError);
    }

    await logAudit(req, "business_application.reject", {
      targetType: "business_application",
      targetId: applicationId,
      details: {
        applicantReferenciaID: application.referenciaid,
        reviewNote
      }
    });

    res.json({
      status: "ok",
      message: "Pedido business recusado com sucesso."
    });
  } catch (error) {
    console.error("[CORPORATION] Erro ao recusar pedido business:", error);
    res.status(500).json({
      status: "error",
      error: "Erro ao recusar pedido business."
    });
  }
});

export default router;
