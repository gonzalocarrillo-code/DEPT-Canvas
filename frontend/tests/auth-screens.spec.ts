import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderProfileScreen } from "../src/account/ProfileScreen.js";
import { renderTenantSettingsScreen } from "../src/admin/TenantSettingsScreen.js";
import {
  canTriggerCreatorAction,
  renderUserRoleScreen,
  type UserRoleScreenState,
} from "../src/admin/UserRoleScreen.js";
import {
  assertFrontendCan,
  capabilitiesForRole,
  RBAC_ROLES,
  ROLE_CAPABILITIES,
  type Role,
} from "../src/auth/rbac.js";
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

  it("ships styles for auth account and admin screens", () => {
    const css = readFileSync(new URL("../src/design/tokens.css", import.meta.url), "utf8");

    expect(css).toContain(".dc-auth-screen");
    expect(css).toContain(".dc-auth-provider");
    expect(css).toContain(".dc-account-screen");
    expect(css).toContain(".dc-account-summary");
    expect(css).toContain(".dc-admin-screen");
    expect(css).toContain(".dc-role-list");
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
    expect(capabilitiesForRole("tenant_admin")).toBe(ROLE_CAPABILITIES.tenant_admin);
  });

  it("a viewer cannot trigger creator actions from frontend state", () => {
    const viewerState: UserRoleScreenState = {
      currentUserRole: "viewer",
      currentUserCapabilities: capabilitiesForRole("viewer"),
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
