export type Role =
  | "viewer"
  | "creator"
  | "brand_owner"
  | "approver"
  | "tenant_admin";

export type Capability =
  | "scene:read"
  | "scene:create"
  | "scene:write"
  | "brand:manage"
  | "content:approve"
  | "tenant:admin";

/**
 * Authoritative RBAC matrix ratified against SECURITY.md §5.2 / spec §5.2.
 *
 * | Role          | scene:read | scene:create/write | brand:manage | content:approve | tenant:admin |
 * |---------------|------------|--------------------|--------------|-----------------|--------------|
 * | viewer        | yes        | no                 | no           | no              | no           |
 * | creator       | yes        | yes                | no           | no              | no           |
 * | brand_owner   | yes        | yes                | yes          | no              | no           |
 * | approver      | yes        | yes                | no           | yes             | no           |
 * | tenant_admin  | yes        | yes                | yes          | yes             | yes          |
 */
export const CAPABILITY_MATRIX: Record<Role, readonly Capability[]> = {
  viewer: ["scene:read"],
  creator: ["scene:read", "scene:create", "scene:write"],
  brand_owner: [
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
  ],
  approver: [
    "scene:read",
    "scene:create",
    "scene:write",
    "content:approve",
  ],
  tenant_admin: [
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
    "content:approve",
    "tenant:admin",
  ],
};

export const ALL_CAPABILITIES: readonly Capability[] = [
  "scene:read",
  "scene:create",
  "scene:write",
  "brand:manage",
  "content:approve",
  "tenant:admin",
];

export const ALL_ROLES: readonly Role[] = [
  "viewer",
  "creator",
  "brand_owner",
  "approver",
  "tenant_admin",
];

export function capabilitiesForRole(role: Role): ReadonlySet<Capability> {
  return new Set(CAPABILITY_MATRIX[role]);
}

export function roleIsAllowed(role: Role, capability: Capability): boolean {
  return capabilitiesForRole(role).has(capability);
}
