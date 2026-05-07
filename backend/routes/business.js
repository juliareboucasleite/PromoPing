import bcrypt from "bcrypt";
import crypto from "crypto";
import express from "express";
import { pool } from "../database/db.js";
import { verifyToken } from "../middleware/auth.js";
import { sendEmail } from "../services/notify.js";
import { gerarReferenciaID } from "../utils/referenciaId.js";

const router = express.Router();

const BUSINESS_PROFILE_ID = 4;
const MEMBER_ROLES = new Set(["owner", "manager", "analyst"]);

function normalizeRole(role, fallback = "analyst") {
  const normalized = String(role || fallback).trim().toLowerCase();
  return MEMBER_ROLES.has(normalized) ? normalized : fallback;
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

function mapOrganizationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
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
    logoUrl: row.logo_url,
    planoAtualId: row.plano_atual_id,
    ownerReferenciaID: row.owner_referenciaid,
    createdAt: row.org_created_at ?? row.created_at,
    updatedAt: row.org_updated_at ?? row.updated_at
  };
}

function mapMembershipRow(row) {
  return {
    id: row.member_id ?? row.id,
    organizationId: row.organization_id,
    referenciaID: row.referenciaid,
    role: row.role,
    status: row.status,
    createdAt: row.member_created_at ?? row.created_at,
    updatedAt: row.member_updated_at ?? row.updated_at,
    organization: mapOrganizationRow(row)
  };
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
    reviewedByReferenciaID: row.reviewed_by_referenciaid,
    reviewedAt: row.reviewed_at,
    approvedOrganizationId: row.approved_organization_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getPerfilId(referenciaID) {
  const [rows] = await pool.query(
    "SELECT PerfilId FROM utilizadores WHERE ReferenciaID = ? LIMIT 1",
    [referenciaID]
  );
  if (!rows.length) return null;
  return Number(rows[0].PerfilId ?? rows[0].perfilid ?? null);
}

async function getPlanIdByName(name, fallbackId = 1) {
  const [rows] = await pool.query(
    "SELECT Id FROM planos WHERE Nome = ? LIMIT 1",
    [name]
  );
  if (!rows.length) return fallbackId;
  return Number(rows[0].Id ?? rows[0].id ?? fallbackId);
}

async function ensureUserConfig(referenciaID, planId) {
  const [existing] = await pool.query(
    "SELECT Id FROM configutilizador WHERE ReferenciaID = ? LIMIT 1",
    [referenciaID]
  );

  if (existing.length > 0) {
    await pool.query(
      "UPDATE configutilizador SET CanalPreferido = ?, PlanoAtualId = ? WHERE ReferenciaID = ?",
      ["email", planId, referenciaID]
    );
    return;
  }

  await pool.query(
    "INSERT INTO configutilizador (ReferenciaID, CanalPreferido, PlanoAtualId) VALUES (?, ?, ?)",
    [referenciaID, "email", planId]
  );
}

async function getLatestApplicationByUser(referenciaID) {
  const [rows] = await pool.query(
    `SELECT *
       FROM business_applications
      WHERE referenciaid = ?
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 1`,
    [referenciaID]
  );
  return rows.length ? rows[0] : null;
}

async function submitBusinessApplication(payload) {
  const {
    referenciaID,
    applicantName,
    applicantEmail,
    applicantPhone,
    nomeEmpresa,
    nif,
    vatNumber,
    website,
    setor,
    categoria,
    pessoaResponsavel,
    telefoneComercial,
    billingEmail,
    morada = {},
    logoUrl,
    requestedPlanName = "Corporate"
  } = payload;

  const existing = await getLatestApplicationByUser(referenciaID);
  if (existing) {
    const [result] = await pool.query(
      `UPDATE business_applications
          SET applicant_name = ?,
              applicant_email = ?,
              applicant_phone = ?,
              nome_empresa = ?,
              nif = ?,
              vat_number = ?,
              website = ?,
              setor = ?,
              categoria = ?,
              pessoa_responsavel = ?,
              telefone_comercial = ?,
              billing_email = ?,
              morada_linha1 = ?,
              morada_linha2 = ?,
              cidade = ?,
              codigo_postal = ?,
              pais = ?,
              logo_url = ?,
              requested_plan_name = ?,
              status = 'pending',
              review_note = NULL,
              reviewed_by_referenciaid = NULL,
              reviewed_at = NULL,
              approved_organization_id = NULL,
              updated_at = CURRENT_TIMESTAMP
        WHERE referenciaid = ?
      RETURNING *`,
      [
        applicantName,
        applicantEmail,
        applicantPhone || null,
        nomeEmpresa,
        nif || null,
        vatNumber || null,
        website || null,
        setor || null,
        categoria || null,
        pessoaResponsavel || null,
        telefoneComercial || null,
        billingEmail || null,
        morada.linha1 || null,
        morada.linha2 || null,
        morada.cidade || null,
        morada.codigoPostal || null,
        morada.pais || null,
        logoUrl || null,
        requestedPlanName,
        referenciaID
      ]
    );
    return result.rows?.[0] || null;
  }

  const [result] = await pool.query(
    `INSERT INTO business_applications (
        referenciaid, applicant_name, applicant_email, applicant_phone,
        nome_empresa, nif, vat_number, website, setor, categoria,
        pessoa_responsavel, telefone_comercial, billing_email,
        morada_linha1, morada_linha2, cidade, codigo_postal, pais,
        logo_url, requested_plan_name, status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
     RETURNING *`,
    [
      referenciaID,
      applicantName,
      applicantEmail,
      applicantPhone || null,
      nomeEmpresa,
      nif || null,
      vatNumber || null,
      website || null,
      setor || null,
      categoria || null,
      pessoaResponsavel || null,
      telefoneComercial || null,
      billingEmail || null,
      morada.linha1 || null,
      morada.linha2 || null,
      morada.cidade || null,
      morada.codigoPostal || null,
      morada.pais || null,
      logoUrl || null,
      requestedPlanName
    ]
  );

  return result.rows?.[0] || null;
}

async function sendBusinessApplicationReceivedEmail(application) {
  const to = application.billing_email || application.applicant_email;
  if (!to) return;

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2>Pedido business recebido</h2>
      <p>Olá ${application.applicant_name || "equipa"},</p>
      <p>Recebemos o pedido business da empresa <strong>${application.nome_empresa}</strong>.</p>
      <p>O pedido entrou em revisão. Vamos analisar os dados enviados e contactar-vos por email com a decisão.</p>
      <p><strong>Plano pedido:</strong> ${application.requested_plan_name || "Corporate"}</p>
      <p style="color: #666;">PromoPing</p>
    </div>
  `;

  await sendEmail(to, "PromoPing - Pedido business recebido", html);
}

async function requireBusinessProfile(req, res, next) {
  try {
    const referenciaID = req.user?.ReferenciaID;
    if (!referenciaID) {
      return res.status(401).json({ status: "error", error: "Não autenticado" });
    }

    const perfilId = await getPerfilId(referenciaID);
    if (perfilId !== BUSINESS_PROFILE_ID) {
      return res.status(403).json({
        status: "error",
        error: "Acesso restrito a contas business."
      });
    }

    req.businessPerfilId = perfilId;
    next();
  } catch (error) {
    console.error("[BUSINESS] Erro ao validar perfil:", error);
    res.status(500).json({ status: "error", error: "Erro ao validar perfil business." });
  }
}

async function getMembershipsByUser(referenciaID) {
  const [rows] = await pool.query(
    `SELECT
        m.id AS member_id,
        m.organization_id,
        m.referenciaid,
        m.role,
        m.status,
        m.created_at AS member_created_at,
        m.updated_at AS member_updated_at,
        o.id,
        o.slug,
        o.nome_empresa,
        o.nif,
        o.vat_number,
        o.website,
        o.setor,
        o.categoria,
        o.pessoa_responsavel,
        o.telefone_comercial,
        o.billing_email,
        o.morada_linha1,
        o.morada_linha2,
        o.cidade,
        o.codigo_postal,
        o.pais,
        o.logo_url,
        o.plano_atual_id,
        o.owner_referenciaid,
        o.created_at AS org_created_at,
        o.updated_at AS org_updated_at
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.referenciaid = ?
      ORDER BY
        CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
        o.created_at ASC`,
    [referenciaID]
  );

  return rows.map(mapMembershipRow);
}

async function getCurrentMembership(referenciaID, organizationId = null) {
  const [rows] = await pool.query(
    `SELECT
        m.id AS member_id,
        m.organization_id,
        m.referenciaid,
        m.role,
        m.status,
        m.created_at AS member_created_at,
        m.updated_at AS member_updated_at,
        o.id,
        o.slug,
        o.nome_empresa,
        o.nif,
        o.vat_number,
        o.website,
        o.setor,
        o.categoria,
        o.pessoa_responsavel,
        o.telefone_comercial,
        o.billing_email,
        o.morada_linha1,
        o.morada_linha2,
        o.cidade,
        o.codigo_postal,
        o.pais,
        o.logo_url,
        o.plano_atual_id,
        o.owner_referenciaid,
        o.created_at AS org_created_at,
        o.updated_at AS org_updated_at
       FROM organization_members m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.referenciaid = ?
        AND m.status = 'active'
        AND (? IS NULL OR m.organization_id = ?)
      ORDER BY
        CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
        o.created_at ASC
      LIMIT 1`,
    [referenciaID, organizationId, organizationId]
  );

  return rows.length ? mapMembershipRow(rows[0]) : null;
}

async function requireOrganizationRole(req, res, next) {
  try {
    const organizationId = Number.parseInt(
      req.params.organizationId || req.body.organizationId || req.query.organizationId || "",
      10
    );

    if (!organizationId) {
      return res.status(400).json({ status: "error", error: "organizationId inválido." });
    }

    const membership = await getCurrentMembership(req.user.ReferenciaID, organizationId);
    if (!membership) {
      return res.status(404).json({ status: "error", error: "Organização não encontrada para este utilizador." });
    }

    if (!["owner", "manager"].includes(membership.role)) {
      return res.status(403).json({ status: "error", error: "Permissão insuficiente nesta organização." });
    }

    req.businessMembership = membership;
    next();
  } catch (error) {
    console.error("[BUSINESS] Erro ao validar organização:", error);
    res.status(500).json({ status: "error", error: "Erro ao validar organização." });
  }
}

router.post("/register", async (req, res) => {
  const {
    nome,
    email,
    password,
    telefone,
    nomeEmpresa,
    nif,
    vatNumber,
    website,
    setor,
    categoria,
    pessoaResponsavel,
    telefoneComercial,
    billingEmail,
    morada = {},
    logoUrl
  } = req.body || {};

  const nomeFinal = String(nome || "").trim();
  const emailFinal = String(email || "").trim().toLowerCase();
  const passwordFinal = String(password || "");
  const nomeEmpresaFinal = String(nomeEmpresa || "").trim();

  if (!nomeFinal || !emailFinal || !passwordFinal || !nomeEmpresaFinal) {
    return res.status(400).json({
      status: "error",
      error: "Nome, email, password e nome da empresa são obrigatórios."
    });
  }

  if (passwordFinal.length < 6) {
    return res.status(400).json({
      status: "error",
      error: "A password deve ter pelo menos 6 caracteres."
    });
  }

  try {
    const [existing] = await pool.query(
      "SELECT ReferenciaID FROM Utilizadores WHERE Email = ? LIMIT 1",
      [emailFinal]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: "error",
        error: "Já existe uma conta com este email."
      });
    }

    const hashedPassword = await bcrypt.hash(passwordFinal, 10);
    const referenciaID = gerarReferenciaID();

    await pool.query(
      `INSERT INTO Utilizadores
        (ReferenciaID, Nome, Email, SenhaHash, EmailVerificado, Telefone, PerfilId, Ativo, DataRegisto)
       VALUES (?, ?, ?, ?, 1, ?, ?, 1, NOW())`,
      [referenciaID, nomeFinal, emailFinal, hashedPassword, telefone || null, BUSINESS_PROFILE_ID]
    );

    const freePlanId = await getPlanIdByName("Free", 1);
    await ensureUserConfig(referenciaID, freePlanId);

    const application = await submitBusinessApplication({
      referenciaID,
      applicantName: nomeFinal,
      applicantEmail: emailFinal,
      applicantPhone: telefone,
      nomeEmpresa: nomeEmpresaFinal,
      nif,
      vatNumber,
      website,
      setor,
      categoria,
      pessoaResponsavel,
      telefoneComercial,
      billingEmail,
      morada,
      logoUrl,
      requestedPlanName: "Corporate"
    });

    try {
      if (application) {
        await sendBusinessApplicationReceivedEmail(application);
      }
    } catch (mailError) {
      console.error("[BUSINESS] Erro ao enviar email de receção:", mailError.message);
    }

    res.status(201).json({
      status: "ok",
      message: "Pedido business criado com sucesso. A empresa ficará em revisão.",
      referenciaID,
      application: mapApplicationRow(application)
    });
  } catch (error) {
    console.error("[BUSINESS] Erro no registo business:", error);
    res.status(500).json({ status: "error", error: "Erro ao criar registo business." });
  }
});

router.use(verifyToken);
router.use(requireBusinessProfile);

router.get("/me", async (req, res) => {
  try {
    const memberships = await getMembershipsByUser(req.user.ReferenciaID);
    const activeMembership = memberships.find((item) => item.status === "active") || memberships[0] || null;
    const application = await getLatestApplicationByUser(req.user.ReferenciaID);

    res.json({
      status: "ok",
      profileId: BUSINESS_PROFILE_ID,
      membershipCount: memberships.length,
      activeMembership,
      memberships,
      application: mapApplicationRow(application)
    });
  } catch (error) {
    console.error("[BUSINESS] Erro ao carregar contexto business:", error);
    res.status(500).json({ status: "error", error: "Erro ao carregar contexto business." });
  }
});

router.post("/onboarding", async (req, res) => {
  const referenciaID = req.user.ReferenciaID;
  const {
    nomeEmpresa,
    nif,
    vatNumber,
    website,
    setor,
    categoria,
    pessoaResponsavel,
    telefoneComercial,
    billingEmail,
    morada = {},
    logoUrl,
    requestedPlanName
  } = req.body || {};

  const nomeEmpresaFinal = String(nomeEmpresa || "").trim();
  if (!nomeEmpresaFinal) {
    return res.status(400).json({ status: "error", error: "Nome da empresa é obrigatório." });
  }

  try {
    const existingMembership = await getCurrentMembership(referenciaID);
    if (existingMembership) {
      return res.status(409).json({
        status: "error",
        error: "Esta conta já foi aprovada e pertence a uma organização business.",
        activeMembership: existingMembership
      });
    }

    const [userRows] = await pool.query(
      "SELECT Nome, Email, Telefone FROM utilizadores WHERE ReferenciaID = ? LIMIT 1",
      [referenciaID]
    );
    if (!userRows.length) {
      return res.status(404).json({ status: "error", error: "Utilizador não encontrado." });
    }

    const user = userRows[0];
    const application = await submitBusinessApplication({
      referenciaID,
      applicantName: user.Nome ?? user.nome ?? "",
      applicantEmail: user.Email ?? user.email ?? "",
      applicantPhone: user.Telefone ?? user.telefone ?? null,
      nomeEmpresa: nomeEmpresaFinal,
      nif,
      vatNumber,
      website,
      setor,
      categoria,
      pessoaResponsavel,
      telefoneComercial,
      billingEmail,
      morada,
      logoUrl,
      requestedPlanName: requestedPlanName || "Corporate"
    });

    try {
      if (application) {
        await sendBusinessApplicationReceivedEmail(application);
      }
    } catch (mailError) {
      console.error("[BUSINESS] Erro ao enviar email de receção:", mailError.message);
    }

    res.status(201).json({
      status: "ok",
      message: "Pedido business enviado para revisão.",
      application: mapApplicationRow(application)
    });
  } catch (error) {
    console.error("[BUSINESS] Erro no onboarding:", error);
    res.status(500).json({ status: "error", error: "Erro ao submeter pedido business." });
  }
});

router.put("/organization/:organizationId", requireOrganizationRole, async (req, res) => {
  const {
    nomeEmpresa,
    nif,
    vatNumber,
    website,
    setor,
    categoria,
    pessoaResponsavel,
    telefoneComercial,
    billingEmail,
    morada = {},
    logoUrl,
    planoAtualId
  } = req.body || {};

  const updates = [];
  const values = [];

  const assign = (column, value) => {
    updates.push(`${column} = ?`);
    values.push(value);
  };

  if (nomeEmpresa !== undefined) assign("nome_empresa", String(nomeEmpresa || "").trim() || null);
  if (nif !== undefined) assign("nif", nif || null);
  if (vatNumber !== undefined) assign("vat_number", vatNumber || null);
  if (website !== undefined) assign("website", website || null);
  if (setor !== undefined) assign("setor", setor || null);
  if (categoria !== undefined) assign("categoria", categoria || null);
  if (pessoaResponsavel !== undefined) assign("pessoa_responsavel", pessoaResponsavel || null);
  if (telefoneComercial !== undefined) assign("telefone_comercial", telefoneComercial || null);
  if (billingEmail !== undefined) assign("billing_email", billingEmail || null);
  if (logoUrl !== undefined) assign("logo_url", logoUrl || null);
  if (planoAtualId !== undefined) assign("plano_atual_id", planoAtualId || null);
  if (morada.linha1 !== undefined) assign("morada_linha1", morada.linha1 || null);
  if (morada.linha2 !== undefined) assign("morada_linha2", morada.linha2 || null);
  if (morada.cidade !== undefined) assign("cidade", morada.cidade || null);
  if (morada.codigoPostal !== undefined) assign("codigo_postal", morada.codigoPostal || null);
  if (morada.pais !== undefined) assign("pais", morada.pais || null);

  if (!updates.length) {
    return res.json({ status: "ok", message: "Nada para atualizar." });
  }

  try {
    values.push(req.businessMembership.organizationId);
    const [result] = await pool.query(
      `UPDATE organizations
          SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      RETURNING *`,
      values
    );

    const updated = result.rows?.[0];
    res.json({ status: "ok", organization: mapOrganizationRow(updated) });
  } catch (error) {
    console.error("[BUSINESS] Erro ao atualizar organização:", error);
    res.status(500).json({ status: "error", error: "Erro ao atualizar organização." });
  }
});

router.get("/organization/:organizationId/members", requireOrganizationRole, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
          m.id,
          m.organization_id,
          m.referenciaid,
          m.role,
          m.status,
          m.created_at,
          u.nome,
          u.email,
          u.telefone
         FROM organization_members m
         JOIN utilizadores u ON u.referenciaid = m.referenciaid
        WHERE m.organization_id = ?
        ORDER BY
          CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
          u.nome ASC`,
      [req.businessMembership.organizationId]
    );

    res.json({
      status: "ok",
      organizationId: req.businessMembership.organizationId,
      members: rows.map((row) => ({
        id: row.id,
        organizationId: row.organization_id,
        referenciaID: row.referenciaid,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        role: row.role,
        status: row.status,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("[BUSINESS] Erro ao listar membros:", error);
    res.status(500).json({ status: "error", error: "Erro ao listar membros da organização." });
  }
});

router.post("/organization/:organizationId/invites", requireOrganizationRole, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const role = normalizeRole(req.body?.role, "analyst");
  const expiresInDays = Math.max(1, Math.min(Number.parseInt(req.body?.expiresInDays || "7", 10) || 7, 30));

  if (!email) {
    return res.status(400).json({ status: "error", error: "Email é obrigatório." });
  }

  try {
    const inviteToken = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const [result] = await pool.query(
      `INSERT INTO organization_invites (
          organization_id, email, role, invite_token, status, invited_by_referenciaid, expires_at
       ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
       RETURNING *`,
      [
        req.businessMembership.organizationId,
        email,
        role,
        inviteToken,
        req.user.ReferenciaID,
        expiresAt.toISOString()
      ]
    );

    const invite = result.rows?.[0];
    res.status(201).json({
      status: "ok",
      invite: {
        id: invite?.id,
        organizationId: invite?.organization_id,
        email: invite?.email,
        role: invite?.role,
        inviteToken: invite?.invite_token,
        status: invite?.status,
        expiresAt: invite?.expires_at
      }
    });
  } catch (error) {
    console.error("[BUSINESS] Erro ao criar convite:", error);
    res.status(500).json({ status: "error", error: "Erro ao criar convite business." });
  }
});

export default router;
