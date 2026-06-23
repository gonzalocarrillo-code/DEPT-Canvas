import type { z } from "zod";
import { assertTenantSceneRef } from "@dept-canvas/renderer/cesdk-render";
import type { CallerContext } from "../auth/tenant-context.js";
import { withToolAudit, ToolError } from "./_context.js";
import { LoadSceneInput, LoadSceneOutput } from "./_schemas.js";
import { getSceneStorage } from "../storage/index.js";

// Strict — the sceneId segment is a UUID charset (no dots/slashes) so a crafted
// ref can't traverse out of {root}/{tenant}/. Tenant prefix is re-checked by
// assertTenantSceneRef and storage reads by the token tenant.
const SCENE_REF = /^tenant\/([A-Za-z0-9._-]+)\/scenes\/([A-Za-z0-9_-]+)\.scene$/;

// Read a persisted .scene back. Tenant isolation is enforced twice: the sceneRef
// must belong to the caller's tenant (assertTenantSceneRef), and storage reads
// by the token tenant id — a ref for another tenant can never be loaded.
export async function loadScene(
  ctx: CallerContext,
  input: z.infer<typeof LoadSceneInput>,
) {
  const parsed = LoadSceneInput.parse(input);

  return withToolAudit(ctx, "load_scene", parsed, async () => {
    assertTenantSceneRef(ctx.tenantId, parsed.sceneRef);
    const match = SCENE_REF.exec(parsed.sceneRef);
    if (!match) {
      throw new ToolError(`Malformed sceneRef: ${parsed.sceneRef}`);
    }
    const sceneId = match[2];
    const bytes = await getSceneStorage().loadScene(ctx.tenantId, sceneId);
    return LoadSceneOutput.parse({
      sceneRef: parsed.sceneRef,
      sceneId,
      scene: bytes.toString("utf8"),
      sizeBytes: bytes.byteLength,
    });
  });
}
