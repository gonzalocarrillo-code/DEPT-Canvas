import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearAuditLogForTests } from "../src/audit/audit-writer.js";
import { clearJobRegistry } from "../src/engine/job-registry.js";
import type { CallerContext } from "../src/auth/tenant-context.js";
import {
  LocalFsSceneStorage,
  setSceneStorageForTests,
} from "../src/storage/index.js";
import { createScene } from "../src/tools/create-scene.js";
import { saveScene } from "../src/tools/save-scene.js";

const tenantA: CallerContext = {
  tenantId: "tenant-a",
  userId: "creator-1",
  role: "creator",
};

const tenantB: CallerContext = {
  tenantId: "tenant-b",
  userId: "creator-2",
  role: "creator",
};

describe("scene storage", () => {
  let tempRoot: string;

  afterEach(async () => {
    setSceneStorageForTests(undefined);
    clearJobRegistry();
    await clearAuditLogForTests();
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("local_fs_writes_tenant_scoped_scene_bytes", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "scene-storage-"));
    const storage = new LocalFsSceneStorage(tempRoot);
    setSceneStorageForTests(storage);

    const scene = await createScene(tenantA, {
      width: 800,
      height: 600,
      layout: "Free",
    });

    const saved = await saveScene(tenantA, {
      jobId: scene.jobId,
      archive: false,
    });

    const sceneId = saved.sceneRef.split("/").pop()!.replace(".scene", "");
    const filePath = storage.resolveFilePath(tenantA.tenantId, sceneId);
    const bytes = await readFile(filePath);

    expect(saved.sceneRef).toBe(
      `tenant/${tenantA.tenantId}/scenes/${sceneId}.scene`,
    );
    expect(bytes.length).toBeGreaterThan(0);
    expect(filePath).toContain(path.join(tenantA.tenantId, `${sceneId}.scene`));
    expect(filePath).not.toContain(tenantB.tenantId);
  });

  it("save_scene_uses_token_tenant_not_argument_tenant_id", async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "scene-storage-"));
    const storage = new LocalFsSceneStorage(tempRoot);
    setSceneStorageForTests(storage);

    const scene = await createScene(tenantA, {
      width: 640,
      height: 480,
      layout: "Free",
    });

    const saved = await saveScene(tenantA, {
      jobId: scene.jobId,
      archive: false,
    });

    const sceneId = saved.sceneRef.split("/").pop()!.replace(".scene", "");
    const tenantAPath = storage.resolveFilePath(tenantA.tenantId, sceneId);
    const tenantBPath = storage.resolveFilePath(tenantB.tenantId, sceneId);

    await expect(readFile(tenantAPath)).resolves.toBeDefined();
    await expect(readFile(tenantBPath)).rejects.toThrow();
  });
});
