import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SceneStorage } from "./types.js";

export class LocalFsSceneStorage implements SceneStorage {
  constructor(private readonly rootDir: string) {}

  /** Absolute path for a persisted scene file (tests / local inspection). */
  resolveFilePath(tenantId: string, sceneId: string): string {
    return path.join(this.rootDir, tenantId, `${sceneId}.scene`);
  }

  async saveScene(
    tenantId: string,
    sceneId: string,
    data: Buffer,
  ): Promise<string> {
    const tenantDir = path.join(this.rootDir, tenantId);
    await mkdir(tenantDir, { recursive: true });
    await writeFile(this.resolveFilePath(tenantId, sceneId), data);
    return `tenant/${tenantId}/scenes/${sceneId}.scene`;
  }

  async loadScene(tenantId: string, sceneId: string): Promise<Buffer> {
    return readFile(this.resolveFilePath(tenantId, sceneId));
  }
}
