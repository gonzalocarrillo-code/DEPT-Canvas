import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { getSceneStorage } from "../storage/index.js";
import { SaveSceneInput, SaveSceneOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";

async function serializeSceneBytes(
  engine: { scene: { saveToString(): Promise<string>; saveToArchive(): Promise<unknown> } },
  archive: boolean,
): Promise<Buffer> {
  if (archive) {
    const data = await engine.scene.saveToArchive();
    if (typeof data === "string") {
      return Buffer.from(data, "utf8");
    }
    if (data instanceof Uint8Array) {
      return Buffer.from(data);
    }
    if (data instanceof ArrayBuffer) {
      return Buffer.from(data);
    }
    if (data && typeof data === "object" && "arrayBuffer" in data) {
      const blob = data as Blob;
      return Buffer.from(await blob.arrayBuffer());
    }
    throw new Error("Unsupported archive serialization format from CE.SDK");
  }

  const sceneString = await engine.scene.saveToString();
  return Buffer.from(sceneString, "utf8");
}

export async function saveScene(
  ctx: CallerContext,
  input: z.infer<typeof SaveSceneInput>,
) {
  const parsed = SaveSceneInput.parse(input);
  return withToolAudit(ctx, "save_scene", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const sceneId = randomUUID();
    const bytes = await serializeSceneBytes(job.engine, parsed.archive ?? false);
    const sceneRef = await getSceneStorage().saveScene(
      ctx.tenantId,
      sceneId,
      bytes,
    );
    return SaveSceneOutput.parse({ sceneRef });
  });
}

export const FORBIDDEN_TOOL_NAMES = [
  "delete",
  "publish",
  "set_keyframe",
  "add_animation",
] as const;
