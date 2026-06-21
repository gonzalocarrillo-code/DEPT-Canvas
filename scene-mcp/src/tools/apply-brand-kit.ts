import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { ApplyBrandKitInput, ApplyBrandKitOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";

export async function applyBrandKit(
  ctx: CallerContext,
  input: z.infer<typeof ApplyBrandKitInput>,
) {
  const parsed = ApplyBrandKitInput.parse(input);
  return withToolAudit(ctx, "apply_brand_kit", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    job.brandKit = parsed.brandKit;
    return ApplyBrandKitOutput.parse({ applied: true });
  });
}
