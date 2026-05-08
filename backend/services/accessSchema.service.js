import { pool } from "../database/db.js";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CODES,
  ROLE_CODES
} from "./accessCatalog.js";

let ensurePromise = null;

const ROLE_DEFINITIONS = [
  { code: ROLE_CODES.consumer, scope: "global", name: "Consumer", description: "Conta pessoal padrão." },
  { code: ROLE_CODES.businessPending, scope: "global", name: "Business Pending", description: "Conta business em revisão ou sem membership ativo." },
  { code: ROLE_CODES.businessOwner, scope: "organization", name: "Business Owner", description: "Owner da organização business." },
  { code: ROLE_CODES.businessManager, scope: "organization", name: "Business Manager", description: "Gestor da organização business." },
  { code: ROLE_CODES.businessAnalyst, scope: "organization", name: "Business Analyst", description: "Acesso de leitura à organização business." },
  { code: ROLE_CODES.supportAgent, scope: "global", name: "Support Agent", description: "Operador de suporte." },
  { code: ROLE_CODES.supportAdmin, scope: "global", name: "Support Admin", description: "Administração do painel de suporte." },
  { code: ROLE_CODES.corporationAdmin, scope: "global", name: "Corporation Admin", description: "Administração corporativa interna." }
];

const PERMISSION_DEFINITIONS = [
  { code: PERMISSION_CODES.portalConsumer, description: "Acesso ao portal consumidor." },
  { code: PERMISSION_CODES.portalBusiness, description: "Acesso ao portal business." },
  { code: PERMISSION_CODES.portalCorporation, description: "Acesso ao portal corporation." },
  { code: PERMISSION_CODES.portalSupport, description: "Acesso ao portal support." },
  { code: PERMISSION_CODES.businessApplicationRead, description: "Ver candidatura business." },
  { code: PERMISSION_CODES.businessOrganizationRead, description: "Ver dados da organização business." },
  { code: PERMISSION_CODES.businessOrganizationManage, description: "Editar dados da organização business." },
  { code: PERMISSION_CODES.businessMembersManage, description: "Gerir membros da organização business." },
  { code: PERMISSION_CODES.supportRead, description: "Ler tickets de suporte." },
  { code: PERMISSION_CODES.supportReply, description: "Responder tickets de suporte." },
  { code: PERMISSION_CODES.supportAdmin, description: "Administração do suporte." },
  { code: PERMISSION_CODES.supportDiscordRequest, description: "Criar pedidos Discord sujeitos a aprovação." },
  { code: PERMISSION_CODES.adminPanel, description: "Acesso ao painel administrativo legado." },
  { code: PERMISSION_CODES.adminUserManage, description: "Gerir utilizadores no painel administrativo." },
  { code: PERMISSION_CODES.corporationStaffRead, description: "Ver colaboradores internos." },
  { code: PERMISSION_CODES.corporationStaffManage, description: "Gerir colaboradores internos." },
  { code: PERMISSION_CODES.corporationBusinessApplicationsReview, description: "Aprovar ou rejeitar candidaturas business." },
  { code: PERMISSION_CODES.corporationDiscordApprove, description: "Aprovar envios Discord corporativos." },
  { code: PERMISSION_CODES.internalCalendar, description: "Usar calendário interno." }
];

const ROLE_PERMISSION_MAP = DEFAULT_ROLE_PERMISSIONS;

async function createTables(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_roles (
      id SERIAL PRIMARY KEY,
      code VARCHAR(80) NOT NULL UNIQUE,
      scope VARCHAR(30) NOT NULL DEFAULT 'global',
      name VARCHAR(120) NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_permissions (
      id SERIAL PRIMARY KEY,
      code VARCHAR(120) NOT NULL UNIQUE,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES access_permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (role_id, permission_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS access_user_roles (
      id SERIAL PRIMARY KEY,
      referenciaid VARCHAR(13) NOT NULL,
      role_id INTEGER NOT NULL REFERENCES access_roles(id) ON DELETE CASCADE,
      organization_id INTEGER NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assigned_by_referenciaid VARCHAR(13) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`CREATE INDEX IF NOT EXISTS idx_access_user_roles_ref ON access_user_roles (referenciaid, status)`);
  await connection.query(`CREATE INDEX IF NOT EXISTS idx_access_user_roles_org ON access_user_roles (organization_id, status)`);
}

async function seedRoles(connection) {
  for (const role of ROLE_DEFINITIONS) {
    await connection.query(
      `INSERT INTO access_roles (code, scope, name, description)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (code) DO UPDATE SET
         scope = EXCLUDED.scope,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         updated_at = CURRENT_TIMESTAMP`,
      [role.code, role.scope, role.name, role.description]
    );
  }
}

async function seedPermissions(connection) {
  for (const permission of PERMISSION_DEFINITIONS) {
    await connection.query(
      `INSERT INTO access_permissions (code, description)
       VALUES (?, ?)
       ON CONFLICT (code) DO UPDATE SET
         description = EXCLUDED.description`,
      [permission.code, permission.description]
    );
  }
}

async function seedRolePermissions(connection) {
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_MAP)) {
    for (const permissionCode of permissionCodes) {
      await connection.query(
        `INSERT INTO access_role_permissions (role_id, permission_id)
         SELECT r.id, p.id
           FROM access_roles r
           JOIN access_permissions p ON p.code = ?
          WHERE r.code = ?
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [permissionCode, roleCode]
      );
    }
  }
}

export async function ensureAccessControlTables(connection = pool) {
  await createTables(connection);
  await seedRoles(connection);
  await seedPermissions(connection);
  await seedRolePermissions(connection);
}

export async function ensureAccessControlTablesReady() {
  if (!ensurePromise) {
    ensurePromise = ensureAccessControlTables(pool).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}
