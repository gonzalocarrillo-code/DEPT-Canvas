import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { ApplyLockManifestInput, ApplyLockManifestOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";
import { normalizeManifest } from "../locks/manifest.js";

export async function applyLockManifest(
  ctx: CallerContext,
  input: z.infer<typeof ApplyLockManifestInput>,
) {
  const parsed = ApplyLockManifestInput.parse(input);
  return withToolAudit(ctx, "apply_lock_manifest", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    job.lockManifest = normalizeManifest(parsed.manifest);
    return ApplyLockManifestOutput.parse({
      templateId: parsed.manifest.templateId,
      frozenCount: parsed.manifest.frozen.length,
    });
  });
}
