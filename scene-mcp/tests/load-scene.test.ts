import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  LocalFsSceneStorage,
  getSceneStorage,
  setSceneStorageForTests,
} from "../src/storage/index.js";
import { clearAuditLogForTests, readAuditLog } from "../src/audit/audit-writer.js";
import { loadScene } from "../src/tools/load-scene.js";
import type { CallerContext } from "../src/auth/tenant-context.js";

const ctx: CallerContext = { tenantId: "tenant-a", userId: "u", role: "creator" };
let dir: string;

describe("load_scene", () => {
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "scene-store-"));
    setSceneStorageForTests(new LocalFsSceneStorage(dir));
  });

  afterEach(async () => {
    setSceneStorageForTests(undefined);
    await clearAuditLogForTests();
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips persisted scene bytes", async () => {
    const ref = await getSceneStorage().saveScene("tenant-a", "scene-1", Buffer.from("SCENE-BYTES", "utf8"));
    const out = await loadScene(ctx, { sceneRef: ref });
    expect(out.sceneId).toBe("scene-1");
    expect(out.scene).toBe("SCENE-BYTES");
    expect(out.sizeBytes).toBe(11);
  });

  it("denies loading another tenant's scene ref (isolation)", async () => {
    await getSceneStorage().saveScene("tenant-b", "scene-x", Buffer.from("secret", "utf8"));
    await expect(
      loadScene(ctx, { sceneRef: "tenant/tenant-b/scenes/scene-x.scene" }),
    ).rejects.toThrow();
  });

  it("rejects a malformed sceneRef", async () => {
    await expect(loadScene(ctx, { sceneRef: "not-a-ref" })).rejects.toThrow();
  });

  it("storage layer blocks path traversal out of the tenant root (defense in depth)", () => {
    const store = new LocalFsSceneStorage(dir);
    expect(() => store.resolveFilePath("tenant-a", "../../escape")).toThrow(/traversal/i);
    expect(() => store.resolveFilePath("../..", "x")).toThrow(/traversal/i);
  });

  it("allows a viewer to read (scene:read) and audits the load", async () => {
    const ref = await getSceneStorage().saveScene("tenant-a", "scene-2", Buffer.from("y", "utf8"));
    const out = await loadScene({ ...ctx, role: "viewer" }, { sceneRef: ref });
    expect(out.sceneId).toBe("scene-2");
    const log = await readAuditLog();
    expect(log.at(-1)?.tool).toBe("load_scene");
    expect(log.at(-1)?.tenantId).toBe("tenant-a");
  });
});
