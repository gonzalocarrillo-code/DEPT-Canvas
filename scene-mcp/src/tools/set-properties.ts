import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { SetPropertiesInput, SetPropertiesOutput } from "./_schemas.js";
import { requireJob, withToolAudit } from "./_context.js";
import { setTypedProperty } from "../engine/property-io.js";

export async function setProperties(
  ctx: CallerContext,
  input: z.infer<typeof SetPropertiesInput>,
) {
  const parsed = SetPropertiesInput.parse(input);
  return withToolAudit(ctx, "set_properties", parsed, async () => {
    const job = requireJob(parsed.jobId, ctx.tenantId);
    const applied: string[] = [];

    for (const prop of parsed.properties) {
      setTypedProperty(job.engine, parsed.blockId, prop.key, prop.value);
      applied.push(prop.key);
    }

    return SetPropertiesOutput.parse({ applied });
  });
}
