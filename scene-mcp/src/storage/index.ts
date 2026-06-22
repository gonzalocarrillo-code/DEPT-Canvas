import { LocalFsSceneStorage } from "./local-fs.js";
import type { SceneStorage } from "./types.js";

let sceneStorage: SceneStorage | undefined;

export type { SceneStorage } from "./types.js";
export { LocalFsSceneStorage } from "./local-fs.js";

export function getSceneStorage(): SceneStorage {
  if (sceneStorage) {
    return sceneStorage;
  }

  const backend = process.env.SCENE_STORAGE_BACKEND ?? "local";
  if (backend === "local") {
    sceneStorage = new LocalFsSceneStorage(
      process.env.SCENE_STORAGE_LOCAL_DIR ?? ".local-storage",
    );
    return sceneStorage;
  }

  if (backend === "gcs") {
    throw new Error(
      "SCENE_STORAGE_BACKEND=gcs is not implemented; use local for dev",
    );
  }

  throw new Error(`Unknown SCENE_STORAGE_BACKEND: ${backend}`);
}

/** Test seam — inject a storage backend without touching env. */
export function setSceneStorageForTests(storage: SceneStorage | undefined): void {
  sceneStorage = storage;
}
