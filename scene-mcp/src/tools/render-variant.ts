import type { z } from "zod";
import { assertTenantSceneRef } from "@dept-canvas/renderer/cesdk-render";
import {
  enqueueRenderJob,
  estimateRenderJob,
} from "@dept-canvas/renderer/worker";
import type { CallerContext } from "../auth/tenant-context.js";
import { RenderVariantInput, RenderVariantOutput } from "./_schemas.js";
import { ToolError, withToolAudit } from "./_context.js";

export async function renderVariant(
  ctx: CallerContext,
  input: z.infer<typeof RenderVariantInput>,
) {
  const parsed = RenderVariantInput.parse(input);

  return withToolAudit(ctx, "render_variant", parsed, async () => {
    try {
      assertTenantSceneRef(ctx.tenantId, parsed.sceneRef);
    } catch {
      throw new ToolError("sceneRef must be tenant-scoped");
    }

    const estimated = estimateRenderJob(parsed.outputs);
    const job = enqueueRenderJob({
      tenantId: ctx.tenantId,
      sceneRef: parsed.sceneRef,
      outputs: parsed.outputs,
    });

    return RenderVariantOutput.parse({
      renderJobId: job.id,
      estimated,
    });
  });
}
