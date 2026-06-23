import { describe, expect, it } from "vitest";
import { buildCoreTools, assertNoForbiddenTools } from "../src/tools/registry.js";
import { FORBIDDEN_TOOL_NAMES } from "../src/tools/save-scene.js";
import { TOOL_CAPABILITIES } from "../src/auth/rbac.js";

describe("tool surface — no destructive tools", () => {
  const names = buildCoreTools().map((t) => t.name);

  it("registers no forbidden/destructive tool", () => {
    expect(() => assertNoForbiddenTools(names)).not.toThrow();
    for (const forbidden of FORBIDDEN_TOOL_NAMES) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("exposes the new P2/P3 tools", () => {
    expect(names).toContain("generate_asset_standalone");
    expect(names).toContain("load_scene");
  });

  it("every registered tool has an RBAC capability mapping", () => {
    for (const name of names) {
      expect(TOOL_CAPABILITIES[name], `missing capability for ${name}`).toBeDefined();
    }
  });

  it("load_scene is read-only (scene:read)", () => {
    expect(TOOL_CAPABILITIES["load_scene"]).toBe("scene:read");
  });
});
