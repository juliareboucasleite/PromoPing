import { pool } from "../database/db.js";
import { ensureAccessControlTablesReady } from "./accessSchema.service.js";
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_PRIORITY,
  PERMISSION_CODES,
  PORTALS,
  PROFILE_IDS,
  ROLE_CODES
} from "./accessCatalog.js";

export { PERMISSION_CODES, PORTALS, PROFILE_IDS, ROLE_CODES };

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export function normalizePerfilId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isSupportProfile(perfilId) {
  return normalizePerfilId(perfilId) === PROFILE_IDS.support;
}

export function isUserProfile(perfilId) {
  return normalizePerfilId(perfilId) === PROFILE_IDS.user;
}

export function isCorporationProfile(perfilId) {
  return normalizePerfilId(perfilId) === PROFILE_IDS.corporation;
}

export function isBusinessProfile(perfilId) {
  return normalizePerfilId(perfilId) === PROFILE_IDS.business;
}

function getAccountType(perfilId, organizations = []) {
  const activeOrganizations = (organizations || []).filter(
    (organization) => String(organization?.status || "active").toLowerCase() === "active"
  );

  if (isSupportProfile(perfilId) || isCorporationProfile(perfilId)) {
    return "internal_staff";
  }

  if (isBusinessProfile(perfilId) || activeOrganizations.length > 0) {
    return "organization_member";
  }

  return "consumer";
}

function mapOrganizationRoleToAccessRole(role) {
  switch (String(role || "").trim().toLowerCase()) {
    case "owner":
      return ROLE_CODES.businessOwner;
    case "manager":
      return ROLE_CODES.businessManager;
    default:
      return ROLE_CODES.businessAnalyst;
  }
}

function getDefaultRolesForProfileId(perfilId, { hasActiveOrganizationMembership = false } = {}) {
  if (isSupportProfile(perfilId)) {
    return [ROLE_CODES.supportAdmin, ROLE_CODES.supportAgent];
  }

  if (isCorporationProfile(perfilId)) {
    return [ROLE_CODES.corporationAdmin];
  }

  if (isBusinessProfile(perfilId)) {
    return hasActiveOrganizationMembership ? [] : [ROLE_CODES.businessPending];
  }

  return [ROLE_CODES.consumer];
}

function getFallbackPermissions(roleCodes) {
  const permissions = [];
  for (const roleCode of roleCodes) {
    const mapped = DEFAULT_ROLE_PERMISSIONS[roleCode];
    if (mapped) permissions.push(...mapped);
  }
  return unique(permissions);
}

function getAllowedPortalsFromPermissions(permissionCodes) {
  const permissions = new Set(permissionCodes || []);
  const portals = [];
  if (permissions.has(PERMISSION_CODES.portalConsumer)) portals.push(PORTALS.consumer);
  if (permissions.has(PERMISSION_CODES.portalBusiness)) portals.push(PORTALS.business);
  if (permissions.has(PERMISSION_CODES.portalCorporation)) portals.push(PORTALS.corporation);
  if (permissions.has(PERMISSION_CODES.portalSupport)) portals.push(PORTALS.support);
  return unique(portals);
}

function getDefaultPortal(allowedPortals = []) {
  if (allowedPortals.includes(PORTALS.corporation)) return "/corporativo";
  if (allowedPortals.includes(PORTALS.support)) return "/painel-suporte-corporacao/pages/login.html";
  if (allowedPortals.includes(PORTALS.business)) return "/business/dashboard";
  return "/dashboard";
}

function pickPrimaryRole(roleCodes = []) {
  for (const roleCode of DEFAULT_ROLE_PRIORITY) {
    if (roleCodes.includes(roleCode)) return roleCode;
  }
  return roleCodes[0] || ROLE_CODES.consumer;
}

function buildBasicAccessContext(perfilId, organizations = [], extraRoleCodes = [], extraPermissionCodes = []) {
  const activeOrganizations = (organizations || []).filter(
    (organization) => String(organization?.status || "active").toLowerCase() === "active"
  );
  const roles = unique([
    ...getDefaultRolesForProfileId(perfilId, {
      hasActiveOrganizationMembership: activeOrganizations.length > 0
    }),
    ...activeOrganizations.map((org) => mapOrganizationRoleToAccessRole(org.role)),
    ...extraRoleCodes
  ]);

  const permissions = unique([
    ...getFallbackPermissions(roles),
    ...extraPermissionCodes
  ]);
  const allowedPortals = getAllowedPortalsFromPermissions(permissions);

  return {
    profileId: normalizePerfilId(perfilId),
    accountType: getAccountType(perfilId, activeOrganizations),
    primaryRole: pickPrimaryRole(roles),
    roles,
    permissions,
    organizations,
    allowedPortals,
    defaultPortal: getDefaultPortal(allowedPortals)
  };
}

export function buildAccessProfile(perfilId) {
  return buildBasicAccessContext(perfilId);
}

export function hasPortalAccess(accessContext, portal) {
  const normalizedPortal = String(portal || "").trim().toLowerCase();
  return Boolean(accessContext?.allowedPortals?.includes(normalizedPortal));
}

export function hasPermission(accessContext, permissionCode) {
  return Boolean(accessContext?.permissions?.includes(String(permissionCode || "").trim()));
}

export function hasAnyPermission(accessContext, permissionCodes = []) {
  return (permissionCodes || []).some((code) => hasPermission(accessContext, code));
}

export function hasRole(accessContext, roleCode) {
  return Boolean(accessContext?.roles?.includes(String(roleCode || "").trim()));
}

export async function extendUserWithAccess(user) {
  if (!user || typeof user !== "object") return user;
  const referenciaID = user.ReferenciaID ?? user.referenciaid ?? null;
  const perfilId = user.PerfilId ?? user.perfilId ?? null;
  return {
    ...user,
    access: referenciaID
      ? await resolveAccessContext(referenciaID, perfilId)
      : buildAccessProfile(perfilId)
  };
}

export async function resolveAccessContext(referenciaID, fallbackPerfilId = null) {
  const normalizedFallbackPerfilId = normalizePerfilId(fallbackPerfilId);
  if (!referenciaID) {
    return buildAccessProfile(normalizedFallbackPerfilId);
  }

  await ensureAccessControlTablesReady();

  const [userRows] = await pool.query(
    `SELECT ReferenciaID, PerfilId
       FROM utilizadores
      WHERE ReferenciaID = ?
      LIMIT 1`,
    [referenciaID]
  );

  const profileId = normalizePerfilId(
    userRows[0]?.PerfilId
      ?? userRows[0]?.perfilid
      ?? normalizedFallbackPerfilId
  );

  const [membershipRows] = await pool.query(
    `SELECT m.organization_id, m.role, m.status,
            o.nome_empresa, o.slug, o.plano_atual_id
       FROM organization_members m
       LEFT JOIN organizations o ON o.id = m.organization_id
      WHERE m.referenciaid = ?
      ORDER BY
        CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
        m.created_at ASC`,
    [referenciaID]
  );

  const organizations = (membershipRows || []).map((row) => ({
    organizationId: row.organization_id,
    nomeEmpresa: row.nome_empresa || null,
    slug: row.slug || null,
    planoAtualId: row.plano_atual_id || null,
    role: row.role || "analyst",
    status: row.status || "active"
  }));

  const [dbRoleRows] = await pool.query(
    `SELECT r.code AS role_code,
            ur.organization_id
       FROM access_user_roles ur
       JOIN access_roles r ON r.id = ur.role_id
      WHERE ur.referenciaid = ?
        AND ur.status = 'active'`,
    [referenciaID]
  );

  const extraRoleCodes = unique((dbRoleRows || []).map((row) => row.role_code));

  const [permissionRows] = await pool.query(
    `SELECT DISTINCT p.code AS permission_code
       FROM access_user_roles ur
       JOIN access_roles r ON r.id = ur.role_id
       JOIN access_role_permissions rp ON rp.role_id = r.id
       JOIN access_permissions p ON p.id = rp.permission_id
      WHERE ur.referenciaid = ?
        AND ur.status = 'active'`,
    [referenciaID]
  );

  return buildBasicAccessContext(
    profileId,
    organizations,
    extraRoleCodes,
    unique((permissionRows || []).map((row) => row.permission_code))
  );
}

export function canAccessPortal(perfilId, portal) {
  return hasPortalAccess(buildAccessProfile(perfilId), portal);
}
