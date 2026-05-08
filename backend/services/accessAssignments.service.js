import { pool } from "../database/db.js";
import { ensureAccessControlTablesReady } from "./accessSchema.service.js";
import { PROFILE_IDS, ROLE_CODES } from "./accessCatalog.js";

const INTERNAL_MANAGED_ROLES = [
  ROLE_CODES.supportAgent,
  ROLE_CODES.supportAdmin,
  ROLE_CODES.corporationAdmin
];

function normalizePerfilId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getManagedRoleCodesForPerfil(perfilId) {
  const normalized = normalizePerfilId(perfilId);
  if (normalized === PROFILE_IDS.support) {
    return [ROLE_CODES.supportAdmin, ROLE_CODES.supportAgent];
  }

  if (normalized === PROFILE_IDS.corporation) {
    return [ROLE_CODES.corporationAdmin];
  }

  return [];
}

export async function syncLegacyAccessAssignments({
  referenciaID,
  perfilId,
  assignedByReferenciaID = null,
  connection = pool
}) {
  if (!referenciaID) return;

  await ensureAccessControlTablesReady();

  const desiredRoleCodes = getManagedRoleCodesForPerfil(perfilId);
  const [managedRows] = await connection.query(
    `SELECT ur.id, r.code
       FROM access_user_roles ur
       JOIN access_roles r ON r.id = ur.role_id
      WHERE ur.referenciaid = ?
        AND ur.organization_id IS NULL
        AND ur.status = 'active'`,
    [referenciaID]
  );

  const currentRoleCodes = new Set(
    (managedRows || [])
      .map((row) => row.code)
      .filter((code) => INTERNAL_MANAGED_ROLES.includes(code))
  );

  for (const roleCode of INTERNAL_MANAGED_ROLES) {
    if (!desiredRoleCodes.includes(roleCode) && currentRoleCodes.has(roleCode)) {
      await connection.query(
        `UPDATE access_user_roles ur
            SET status = 'inactive',
                updated_at = CURRENT_TIMESTAMP
           FROM access_roles r
          WHERE ur.role_id = r.id
            AND ur.referenciaid = ?
            AND ur.organization_id IS NULL
            AND ur.status = 'active'
            AND r.code = ?`,
        [referenciaID, roleCode]
      );
    }
  }

  for (const roleCode of desiredRoleCodes) {
    if (currentRoleCodes.has(roleCode)) continue;

    await connection.query(
      `INSERT INTO access_user_roles (referenciaid, role_id, organization_id, assigned_by_referenciaid, status)
       SELECT ?, r.id, NULL, ?, 'active'
         FROM access_roles r
        WHERE r.code = ?
       ON CONFLICT DO NOTHING`,
      [referenciaID, assignedByReferenciaID, roleCode]
    );
  }
}

export async function listUserAccessRoles(referenciaIDs = [], connection = pool) {
  const uniqueRefs = Array.from(new Set((referenciaIDs || []).filter(Boolean)));
  if (!uniqueRefs.length) return new Map();

  await ensureAccessControlTablesReady();

  const [rows] = await connection.query(
    `SELECT ur.referenciaid,
            ur.organization_id,
            ur.status,
            r.code AS role_code,
            r.scope AS role_scope
       FROM access_user_roles ur
       JOIN access_roles r ON r.id = ur.role_id
      ORDER BY ur.referenciaid, r.code`
  );

  const result = new Map();
  for (const referenciaID of uniqueRefs) {
    result.set(referenciaID, []);
  }

  for (const row of (rows || []).filter((row) => result.has(row.referenciaid))) {
    if (!result.has(row.referenciaid)) result.set(row.referenciaid, []);
    result.get(row.referenciaid).push({
      code: row.role_code,
      scope: row.role_scope,
      status: row.status,
      organizationId: row.organization_id
    });
  }

  return result;
}
