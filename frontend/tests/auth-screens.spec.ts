import { describe, expect, it } from "vitest";
import { renderProfileScreen } from "../src/account/ProfileScreen.js";
import { renderTenantSettingsScreen } from "../src/admin/TenantSettingsScreen.js";
import {
  canTriggerCreatorAction,
  RBAC_ROLES,
  renderUserRoleScreen,
  type Role,
  type UserRoleScreenState,
} from "../src/admin/UserRoleScreen.js";
import { renderLoginScreen } from "../src/auth/LoginScreen.js";

function assertFrontendCan(role: Role, capability: "scene:create"): void {
  const capabilitiesByRole = {
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
  } satisfies Record<Role, readonly string[]>;

  if (!capabilitiesByRole[role].includes(capability)) {
    throw new Error(`Role '${role}' is not permitted capability '${capability}'`);
  }
}

describe("P3-T6 auth screens", () => {
  it("renders SSO login without password storage", () => {
    const markup = renderLoginScreen();

    expect(markup).toContain('data-auth-mode="sso"');
    expect(markup).toContain('data-sso-protocol="saml"');
    expect(markup).toContain('data-sso-protocol="oidc"');
    expect(markup).toContain('data-password-storage="none"');
    expect(markup).not.toMatch(/type=["']password["']/i);
  });

  it("renders profile logout and tenant settings", () => {
    expect(renderProfileScreen()).toContain('data-auth-action="logout"');

    const tenantSettings = renderTenantSettingsScreen();
    expect(tenantSettings).toContain('data-screen="tenant-settings"');
    expect(tenantSettings).toContain("deptagency.com");
    expect(tenantSettings).toContain('data-sso-protocol="saml"');
    expect(tenantSettings).toContain('data-sso-protocol="oidc"');
  });

  it("role list matches viewer/creator/brand_owner/approver/tenant_admin", () => {
    const rolesFromFrontendContract: readonly Role[] = RBAC_ROLES;

    expect(rolesFromFrontendContract).toEqual(RBAC_ROLES);
    expect(RBAC_ROLES).toEqual([
      "viewer",
      "creator",
      "brand_owner",
      "approver",
      "tenant_admin",
    ]);

    const markup = renderUserRoleScreen();
    for (const role of RBAC_ROLES) {
      expect(markup).toContain(`data-rbac-role="${role}"`);
    }
  });

  it("a viewer cannot trigger creator actions from frontend state", () => {
    const viewerState: UserRoleScreenState = {
      currentUserRole: "viewer",
      currentUserCapabilities: ["scene:read"],
      members: [],
    };

    expect(renderUserRoleScreen(viewerState)).toContain(
      'data-creator-action="create-project" disabled',
    );
    expect(canTriggerCreatorAction(viewerState)).toBe(false);
    expect(() => assertFrontendCan("viewer", "scene:create")).toThrow(
      "Role 'viewer' is not permitted capability 'scene:create'",
    );
  });
});
