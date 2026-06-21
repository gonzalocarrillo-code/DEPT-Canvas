import type { z } from "zod";
import type { CallerContext } from "../auth/tenant-context.js";
import { CreateSceneInput, CreateSceneOutput } from "./_schemas.js";
import { createSceneForTenant } from "./_context.js";

export async function createScene(
  ctx: CallerContext,
  input: z.infer<typeof CreateSceneInput>,
) {
  const parsed = CreateSceneInput.parse(input);
  const result = await createSceneForTenant(ctx, parsed);
  return CreateSceneOutput.parse(result);
}
