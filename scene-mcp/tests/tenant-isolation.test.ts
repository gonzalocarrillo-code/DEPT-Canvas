import { describe, expect, it } from "vitest";
import { createDevToken } from "../src/auth/verify-token.js";
import {
  assertCan,
  capabilityForTool,
  CapabilityDeniedError,
} from "../src/auth/rbac.js";
import {
  contextFromRequest,
  resolveTenantId,
} from "../src/auth/tenant-context.js";

function bearer(payload: {
  sub: string;
  tenant_id: string;
  role:
    | "viewer"
    | "creator"
    | "brand_owner"
    | "approver"
    | "tenant_admin";
}): string {
  return `Bearer ${createDevToken(payload)}`;
}

describe("tenant isolation", () => {
  it("argument_tenant_id_is_ignored", async () => {
    const ctx = await contextFromRequest({
      headers: {
        authorization: bearer({
          sub: "user-a",
          tenant_id: "tenant-alpha",
          role: "creator",
        }),
      },
    });

    const effectiveTenant = resolveTenantId(ctx, {
      tenant_id: "tenant-beta",
      jobId: "job-1",
    });

    expect(effectiveTenant).toBe("tenant-alpha");
    expect(effectiveTenant).not.toBe("tenant-beta");
  });

  it("role_denied_capability_rejected_server_side", async () => {
    const ctx = await contextFromRequest({
      headers: {
        authorization: bearer({
          sub: "viewer-1",
          tenant_id: "tenant-alpha",
          role: "viewer",
        }),
      },
    });

    const createSceneCap = capabilityForTool("create_scene");
    expect(createSceneCap).toBe("scene:create");

    expect(() => assertCan(ctx, createSceneCap!)).toThrow(CapabilityDeniedError);
    expect(() => assertCan(ctx, createSceneCap!)).toThrow(
      /Role 'viewer' is not permitted capability 'scene:create'/,
    );
  });
});
