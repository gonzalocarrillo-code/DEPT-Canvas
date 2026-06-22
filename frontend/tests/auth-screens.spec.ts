import { describe, expect, it } from "vitest";
import { assertCan, type Role as ServerRole } from "../../scene-mcp/src/auth/rbac.js";
import { renderProfileScreen } from "../src/account/ProfileScreen.js";
import { renderTenantSettingsScreen } from "../src/admin/TenantSettingsScreen.js";
import {
  RBAC_ROLES,
  renderUserRoleScreen,
  type UserRoleScreenState,
} from "../src/admin/UserRoleScreen.js";
import { renderLoginScreen } from "../src/auth/LoginScreen.js";

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
    const rolesFromSharedContract: readonly ServerRole[] = RBAC_ROLES;

    expect(rolesFromSharedContract).toEqual(RBAC_ROLES);
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

  it("a viewer cannot trigger creator actions and the server rejects if forced", () => {
    const viewerState: UserRoleScreenState = {
      currentUserRole: "viewer",
      currentUserCapabilities: ["scene:read"],
      members: [],
    };

    expect(renderUserRoleScreen(viewerState)).toContain(
      'data-creator-action="create-project" disabled',
    );
    expect(() => assertCan({ role: "viewer" }, "scene:create")).toThrow(
      "Role 'viewer' is not permitted capability 'scene:create'",
    );
  });
});
