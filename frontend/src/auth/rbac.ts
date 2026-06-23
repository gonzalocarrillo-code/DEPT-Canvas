// Mirrors scene-mcp/src/auth/capability-matrix.ts EXACTLY. The UI only *reflects*
// these; the edge + scene-MCP server are the authoritative enforcement boundary
// (every tool call re-checks the capability). In production this matrix is served
// by the backend so there is a single source of truth.
export type Role = "viewer" | "creator" | "brand_owner" | "approver" | "tenant_admin";
export type Capability =
  | "scene:read"
  | "scene:create"
  | "scene:write"
  | "brand:manage"
  | "content:approve"
  | "tenant:admin";

export const ALL_ROLES: Role[] = ["viewer", "creator", "brand_owner", "approver", "tenant_admin"];
export const ALL_CAPABILITIES: Capability[] = [
  "scene:read",
  "scene:create",
  "scene:write",
  "brand:manage",
  "content:approve",
  "tenant:admin",
];

export const CAPABILITY_MATRIX: Record<Role, Capability[]> = {
  viewer: ["scene:read"],
  creator: ["scene:read", "scene:create", "scene:write"],
  brand_owner: ["scene:read", "scene:create", "scene:write", "brand:manage"],
  approver: ["scene:read", "scene:create", "scene:write", "content:approve"],
  tenant_admin: [
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
    "content:approve",
    "tenant:admin",
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  creator: "Creator",
  brand_owner: "Brand owner",
  approver: "Approver",
  tenant_admin: "Tenant admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Read-only access to scenes and variations.",
  creator: "Create and edit scenes and assets.",
  brand_owner: "Creator plus brand kit and lock management.",
  approver: "Creator plus content approval for delivery.",
  tenant_admin: "Full access including users, brand, approval and tenant settings.",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "scene:read": "View",
  "scene:create": "Create",
  "scene:write": "Edit",
  "brand:manage": "Brand & locks",
  "content:approve": "Approve",
  "tenant:admin": "Tenant admin",
};

export function roleHasCapability(role: Role, cap: Capability): boolean {
  return CAPABILITY_MATRIX[role].includes(cap);
}
