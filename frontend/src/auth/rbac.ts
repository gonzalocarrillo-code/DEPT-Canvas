export const RBAC_ROLES = [
  "viewer",
  "creator",
  "brand_owner",
  "approver",
  "tenant_admin",
] as const;

export type Role = (typeof RBAC_ROLES)[number];

export type Capability =
  | "scene:read"
  | "scene:create"
  | "scene:write"
  | "brand:manage"
  | "content:approve"
  | "tenant:admin";

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  creator: "Creator",
  brand_owner: "Brand owner",
  approver: "Approver",
  tenant_admin: "Tenant admin",
};

export const ROLE_CAPABILITIES = {
  viewer: ["scene:read"],
  creator: ["scene:read", "scene:create", "scene:write"],
  brand_owner: ["scene:read", "scene:create", "scene:write", "brand:manage"],
  approver: ["scene:read", "content:approve"],
  tenant_admin: [
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
    "content:approve",
    "tenant:admin",
  ],
} as const satisfies Record<Role, readonly Capability[]>;

export function capabilitiesForRole(role: Role): readonly Capability[] {
  return ROLE_CAPABILITIES[role];
}

export function hasCapabilityForRole(role: Role, capability: Capability): boolean {
  return capabilitiesForRole(role).includes(capability);
}

export function assertFrontendCan(role: Role, capability: Capability): void {
  if (!hasCapabilityForRole(role, capability)) {
    throw new Error(`Role '${role}' is not permitted capability '${capability}'`);
  }
}
