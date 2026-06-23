import { describe, it, expect } from "vitest";
import { ALL_ROLES, roleHasCapability } from "@/auth/rbac";
import { valueAt } from "@/editor/animation";
import { composeEffects } from "@/editor/effects";

describe("RBAC (mirrors the backend capability matrix)", () => {
  it("has the 5 roles", () => {
    expect(ALL_ROLES).toEqual([
      "viewer",
      "creator",
      "brand_owner",
      "approver",
      "tenant_admin",
    ]);
  });

  it("viewer is read-only", () => {
    expect(roleHasCapability("viewer", "scene:read")).toBe(true);
    expect(roleHasCapability("viewer", "scene:write")).toBe(false);
  });

  it("only tenant_admin can administer the tenant", () => {
    const admins = ALL_ROLES.filter((r) => roleHasCapability(r, "tenant:admin"));
    expect(admins).toEqual(["tenant_admin"]);
  });

  it("brand_owner manages brand; approver approves; neither does the other", () => {
    expect(roleHasCapability("brand_owner", "brand:manage")).toBe(true);
    expect(roleHasCapability("approver", "content:approve")).toBe(true);
    expect(roleHasCapability("brand_owner", "content:approve")).toBe(false);
    expect(roleHasCapability("approver", "brand:manage")).toBe(false);
  });
});

describe("keyframe interpolation", () => {
  const kf = [
    { t: 0, value: 0, ease: "Linear" },
    { t: 1, value: 100, ease: "Linear" },
  ];
  it("holds before the first and after the last keyframe", () => {
    expect(valueAt(kf, -1, 0)).toBe(0);
    expect(valueAt(kf, 5, 0)).toBe(100);
  });
  it("interpolates linearly between keyframes", () => {
    expect(valueAt(kf, 0.5, 0)).toBeCloseTo(50);
  });
  it("falls back when no keyframes", () => {
    expect(valueAt(undefined, 0.5, 7)).toBe(7);
  });
});

describe("effect stack composition", () => {
  it("composes a CSS filter from enabled effects", () => {
    const { filter } = composeEffects([
      { id: "1", type: "blur", enabled: true, params: { amount: 5 } },
      { id: "2", type: "glow", enabled: true, params: { size: 10 }, color: "#fff" },
    ]);
    expect(filter).toContain("blur(5px)");
    expect(filter).toContain("drop-shadow(0 0 10px #fff)");
  });
  it("skips disabled effects and surfaces vignette as an overlay", () => {
    const { filter, vignette } = composeEffects([
      { id: "1", type: "blur", enabled: false, params: { amount: 5 } },
      { id: "2", type: "vignette", enabled: true, params: { darkness: 0.6 } },
    ]);
    expect(filter).toBe("");
    expect(vignette?.darkness).toBe(0.6);
  });
});
