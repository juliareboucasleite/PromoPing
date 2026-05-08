import { pool } from "../database/db.js";

let ensurePromise = null;

async function createOrganizationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(120) NOT NULL UNIQUE,
      nome_empresa VARCHAR(180) NOT NULL,
      nif VARCHAR(40) NULL,
      vat_number VARCHAR(64) NULL,
      website VARCHAR(255) NULL,
      setor VARCHAR(120) NULL,
      categoria VARCHAR(120) NULL,
      pessoa_responsavel VARCHAR(150) NULL,
      telefone_comercial VARCHAR(40) NULL,
      billing_email VARCHAR(255) NULL,
      morada_linha1 VARCHAR(255) NULL,
      morada_linha2 VARCHAR(255) NULL,
      cidade VARCHAR(120) NULL,
      codigo_postal VARCHAR(40) NULL,
      pais VARCHAR(80) NULL,
      logo_url TEXT NULL,
      plano_atual_id INTEGER NULL,
      owner_referenciaid VARCHAR(13) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations (owner_referenciaid)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_organizations_plan ON organizations (plano_atual_id)`);
}

async function createOrganizationMembersTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      referenciaid VARCHAR(13) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'analyst',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, referenciaid)
    )
  `);

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_org_members_ref ON organization_members (referenciaid)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_org_members_org_status ON organization_members (organization_id, status)`);
}

async function createBusinessApplicationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS business_applications (
      id SERIAL PRIMARY KEY,
      referenciaid VARCHAR(13) NOT NULL,
      applicant_name VARCHAR(150) NOT NULL,
      applicant_email VARCHAR(255) NOT NULL,
      applicant_phone VARCHAR(40) NULL,
      nome_empresa VARCHAR(180) NOT NULL,
      nif VARCHAR(40) NULL,
      vat_number VARCHAR(64) NULL,
      website VARCHAR(255) NULL,
      setor VARCHAR(120) NULL,
      categoria VARCHAR(120) NULL,
      pessoa_responsavel VARCHAR(150) NULL,
      telefone_comercial VARCHAR(40) NULL,
      billing_email VARCHAR(255) NULL,
      morada_linha1 VARCHAR(255) NULL,
      morada_linha2 VARCHAR(255) NULL,
      cidade VARCHAR(120) NULL,
      codigo_postal VARCHAR(40) NULL,
      pais VARCHAR(80) NULL,
      logo_url TEXT NULL,
      requested_plan_name VARCHAR(120) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      review_note TEXT NULL,
      reviewed_by_referenciaid VARCHAR(13) NULL,
      reviewed_at TIMESTAMP NULL,
      approved_organization_id INTEGER NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_business_applications_ref ON business_applications (referenciaid)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_business_applications_status ON business_applications (status, created_at DESC)`);
}

async function createOrganizationInvitesTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS organization_invites (
      id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'analyst',
      invite_token VARCHAR(128) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      invited_by_referenciaid VARCHAR(13) NOT NULL,
      accepted_by_referenciaid VARCHAR(13) NULL,
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_org_invites_org_status ON organization_invites (organization_id, status)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_org_invites_email_status ON organization_invites (email, status)`);
}

export async function ensureBusinessTables(connection = pool) {
  await createOrganizationsTable(connection);
  await createOrganizationMembersTable(connection);
  await createBusinessApplicationsTable(connection);
  await createOrganizationInvitesTable(connection);
}

export async function ensureBusinessTablesReady() {
  if (!ensurePromise) {
    ensurePromise = ensureBusinessTables(pool).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}
