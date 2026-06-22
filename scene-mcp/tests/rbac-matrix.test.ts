import { describe, expect, it } from "vitest";
import {
  ALL_CAPABILITIES,
  ALL_ROLES,
  CAPABILITY_MATRIX,
  roleIsAllowed,
} from "../src/auth/capability-matrix.js";
import {
  assertCan,
  CapabilityDeniedError,
  roleHasCapability,
} from "../src/auth/rbac.js";
import {
  assertSameTenant,
  contextFromRequest,
  TenantAccessDeniedError,
} from "../src/auth/tenant-context.js";
import { createDevToken } from "../src/auth/verify-token.js";
import type { Role } from "../src/auth/capability-matrix.js";

function bearer(role: Role, tenantId: string, sub = `${role}-user`): string {
  return `Bearer ${createDevToken({ sub, tenant_id: tenantId, role })}`;
}

describe("rbac-matrix.test.ts", () => {
  it("matrix_matches_roleHasCapability_for_every_role_and_capability", () => {
    for (const role of ALL_ROLES) {
      const allowed = new Set(CAPABILITY_MATRIX[role]);
      for (const capability of ALL_CAPABILITIES) {
        const expected = allowed.has(capability);
        expect(roleHasCapability(role, capability)).toBe(expected);
        expect(roleIsAllowed(role, capability)).toBe(expected);
      }
    }
  });

  it.each(ALL_ROLES.map((role) => [role]))(
    "role_%s_allowed_capabilities_pass_assertCan",
    async (role) => {
      const ctx = await contextFromRequest({
        headers: { authorization: bearer(role, "tenant-alpha") },
      });
      for (const capability of CAPABILITY_MATRIX[role]) {
        expect(() => assertCan(ctx, capability)).not.toThrow();
      }
    },
  );

  it.each(ALL_ROLES.map((role) => [role]))(
    "role_%s_denied_capabilities_fail_assertCan",
    async (role) => {
      const ctx = await contextFromRequest({
        headers: { authorization: bearer(role, "tenant-alpha") },
      });
      const allowed = new Set(CAPABILITY_MATRIX[role]);
      for (const capability of ALL_CAPABILITIES) {
        if (allowed.has(capability)) continue;
        expect(() => assertCan(ctx, capability)).toThrow(CapabilityDeniedError);
      }
    },
  );

  it.each(ALL_ROLES.map((role) => [role]))(
    "role_%s_cross_tenant_denied_via_assertSameTenant",
    async (role) => {
      const ctx = await contextFromRequest({
        headers: { authorization: bearer(role, "tenant-alpha") },
      });
      expect(() => assertSameTenant(ctx, "tenant-beta")).toThrow(
        TenantAccessDeniedError,
      );
      expect(() => assertSameTenant(ctx, "tenant-beta")).toThrow(
        /cannot access tenant 'tenant-beta'/,
      );
    },
  );
});
