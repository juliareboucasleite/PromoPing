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

export const ROLE_CODES = Object.freeze({
  consumer: "consumer",
  businessPending: "business_pending",
  businessOwner: "business_owner",
  businessManager: "business_manager",
  businessAnalyst: "business_analyst",
  supportAgent: "support_agent",
  supportAdmin: "support_admin",
  corporationAdmin: "corporation_admin"
});

export const PERMISSION_CODES = Object.freeze({
  portalConsumer: "portal.consumer",
  portalBusiness: "portal.business",
  portalCorporation: "portal.corporation",
  portalSupport: "portal.support",
  businessApplicationRead: "business.application.read",
  businessOrganizationRead: "business.organization.read",
  businessOrganizationManage: "business.organization.manage",
  businessMembersManage: "business.members.manage",
  supportRead: "support.read",
  supportReply: "support.reply",
  supportAdmin: "support.admin",
  supportDiscordRequest: "support.discord.request",
  adminPanel: "admin.panel",
  adminUserManage: "admin.user.manage",
  corporationStaffRead: "corporation.staff.read",
  corporationStaffManage: "corporation.staff.manage",
  corporationBusinessApplicationsReview: "corporation.business_applications.review",
  corporationDiscordApprove: "corporation.discord.approve",
  internalCalendar: "internal.calendar"
});

export const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  [ROLE_CODES.consumer]: [
    PERMISSION_CODES.portalConsumer
  ],
  [ROLE_CODES.businessPending]: [
    PERMISSION_CODES.portalConsumer,
    PERMISSION_CODES.portalBusiness,
    PERMISSION_CODES.businessApplicationRead
  ],
  [ROLE_CODES.businessOwner]: [
    PERMISSION_CODES.portalConsumer,
    PERMISSION_CODES.portalBusiness,
    PERMISSION_CODES.businessApplicationRead,
    PERMISSION_CODES.businessOrganizationRead,
    PERMISSION_CODES.businessOrganizationManage,
    PERMISSION_CODES.businessMembersManage
  ],
  [ROLE_CODES.businessManager]: [
    PERMISSION_CODES.portalConsumer,
    PERMISSION_CODES.portalBusiness,
    PERMISSION_CODES.businessApplicationRead,
    PERMISSION_CODES.businessOrganizationRead,
    PERMISSION_CODES.businessOrganizationManage
  ],
  [ROLE_CODES.businessAnalyst]: [
    PERMISSION_CODES.portalConsumer,
    PERMISSION_CODES.portalBusiness,
    PERMISSION_CODES.businessApplicationRead,
    PERMISSION_CODES.businessOrganizationRead
  ],
  [ROLE_CODES.supportAgent]: [
    PERMISSION_CODES.portalSupport,
    PERMISSION_CODES.supportRead,
    PERMISSION_CODES.supportReply,
    PERMISSION_CODES.supportDiscordRequest,
    PERMISSION_CODES.internalCalendar
  ],
  [ROLE_CODES.supportAdmin]: [
    PERMISSION_CODES.portalSupport,
    PERMISSION_CODES.supportRead,
    PERMISSION_CODES.supportReply,
    PERMISSION_CODES.supportAdmin,
    PERMISSION_CODES.supportDiscordRequest,
    PERMISSION_CODES.adminPanel,
    PERMISSION_CODES.adminUserManage,
    PERMISSION_CODES.internalCalendar
  ],
  [ROLE_CODES.corporationAdmin]: [
    PERMISSION_CODES.portalCorporation,
    PERMISSION_CODES.portalSupport,
    PERMISSION_CODES.supportRead,
    PERMISSION_CODES.supportReply,
    PERMISSION_CODES.corporationStaffRead,
    PERMISSION_CODES.corporationStaffManage,
    PERMISSION_CODES.corporationBusinessApplicationsReview,
    PERMISSION_CODES.corporationDiscordApprove,
    PERMISSION_CODES.internalCalendar
  ]
});

export const DEFAULT_ROLE_PRIORITY = [
  ROLE_CODES.supportAdmin,
  ROLE_CODES.corporationAdmin,
  ROLE_CODES.supportAgent,
  ROLE_CODES.businessOwner,
  ROLE_CODES.businessManager,
  ROLE_CODES.businessAnalyst,
  ROLE_CODES.businessPending,
  ROLE_CODES.consumer
];
