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

export class CapabilityDeniedError extends Error {
  readonly role: Role;
  readonly capability: Capability;

  constructor(role: Role, capability: Capability) {
    super(`Role '${role}' is not permitted capability '${capability}'`);
    this.name = "CapabilityDeniedError";
    this.role = role;
    this.capability = capability;
  }
}

const ROLE_CAPABILITIES: Record<Role, ReadonlySet<Capability>> = {
  viewer: new Set(["scene:read"]),
  creator: new Set(["scene:read", "scene:create", "scene:write"]),
  brand_owner: new Set([
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
  ]),
  approver: new Set([
    "scene:read",
    "scene:create",
    "scene:write",
    "content:approve",
  ]),
  tenant_admin: new Set([
    "scene:read",
    "scene:create",
    "scene:write",
    "brand:manage",
    "content:approve",
    "tenant:admin",
  ]),
};

export const TOOL_CAPABILITIES: Record<string, Capability> = {
  create_scene: "scene:create",
  create_block: "scene:write",
  set_properties: "scene:write",
  apply_brand_kit: "brand:manage",
  apply_lock_manifest: "brand:manage",
  generate_asset: "scene:write",
  save_scene: "scene:write",
  render_variant: "scene:write",
  apply_intent: "scene:write",
  stagger: "scene:write",
  set_timing: "scene:write",
  sequence: "scene:write",
  query_animatable: "scene:read",
};

export function capabilityForTool(toolName: string): Capability | undefined {
  return TOOL_CAPABILITIES[toolName];
}

export function roleHasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

export function assertCan(
  ctx: { role: Role },
  capability: Capability,
): void {
  if (!roleHasCapability(ctx.role, capability)) {
    throw new CapabilityDeniedError(ctx.role, capability);
  }
}
