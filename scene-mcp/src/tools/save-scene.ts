import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { SaveSceneInput, SaveSceneOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";

export async function saveScene(
  ctx: CallerContext,
  input: z.infer<typeof SaveSceneInput>,
) {
  const parsed = SaveSceneInput.parse(input);
  return withToolAudit(ctx, "save_scene", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);

    if (parsed.archive) {
      await job.engine.scene.saveToArchive();
    } else {
      await job.engine.scene.saveToString();
    }

    const sceneRef = `tenant/${ctx.tenantId}/scenes/${randomUUID()}.scene`;
    return SaveSceneOutput.parse({ sceneRef });
  });
}

export const FORBIDDEN_TOOL_NAMES = [
  "delete",
  "publish",
  "set_keyframe",
  "add_animation",
] as const;
