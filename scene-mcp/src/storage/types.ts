/** Persists serialized CE.SDK scene bytes; tenant id is always supplied server-side. */
export interface SceneStorage {
  /**
   * Write scene bytes for a tenant. Returns a logical sceneRef (not a filesystem path).
   * `tenantId` must come from the verified token — never from tool arguments.
   */
  saveScene(
    tenantId: string,
    sceneId: string,
    data: Buffer,
  ): Promise<string>;

  /**
   * Read scene bytes for a tenant. Throws if the scene is absent.
   * `tenantId` must come from the verified token — never from tool arguments.
   */
  loadScene(tenantId: string, sceneId: string): Promise<Buffer>;
}
