export const PROFILE_IDS = Object.freeze({
  support: 1,
  user: 2,
  corporation: 3,
  business: 4
});

export const PORTALS = Object.freeze({
  consumer: "consumer",
  business: "business",
  corporation: "corporation",
  support: "support"
});

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

export function canAccessPortal(perfilId, portal) {
  return buildAccessProfile(perfilId).allowedPortals.includes(String(portal || "").trim().toLowerCase());
}

export function buildAccessProfile(perfilId) {
  const normalized = normalizePerfilId(perfilId);

  if (isSupportProfile(normalized)) {
    return {
      profileId: normalized,
      accountType: "internal_staff",
      primaryRole: "support_agent",
      roles: ["support_agent"],
      allowedPortals: [PORTALS.support],
      defaultPortal: "/painel-suporte-corporacao/pages/login.html"
    };
  }

  if (isCorporationProfile(normalized)) {
    return {
      profileId: normalized,
      accountType: "internal_staff",
      primaryRole: "corporation_admin",
      roles: ["corporation_admin"],
      allowedPortals: [PORTALS.corporation, PORTALS.support],
      defaultPortal: "/corporativo"
    };
  }

  if (isBusinessProfile(normalized)) {
    return {
      profileId: normalized,
      accountType: "organization_member",
      primaryRole: "business_owner",
      roles: ["business_owner"],
      allowedPortals: [PORTALS.consumer, PORTALS.business],
      defaultPortal: "/business/dashboard"
    };
  }

  return {
    profileId: normalized,
    accountType: "consumer",
    primaryRole: "consumer",
    roles: ["consumer"],
    allowedPortals: [PORTALS.consumer],
    defaultPortal: "/dashboard"
  };
}

export function extendUserWithAccess(user) {
  if (!user || typeof user !== "object") return user;
  const perfilId = user.PerfilId ?? user.perfilId ?? null;
  return {
    ...user,
    access: buildAccessProfile(perfilId)
  };
}
