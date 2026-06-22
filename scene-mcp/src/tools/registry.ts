import type { z } from "zod";
import type { ToolRegistration } from "../server.js";
import type { CallerContext } from "../auth/tenant-context.js";
import { createScene } from "./create-scene.js";
import { createBlock } from "./create-block.js";
import { setProperties } from "./set-properties.js";
import { applyBrandKit } from "./apply-brand-kit.js";
import { applyLockManifest } from "./apply-lock-manifest.js";
import { saveScene } from "./save-scene.js";
import { generateAsset } from "./generate-asset.js";
import { applyIntent } from "./apply-intent.js";
import { stagger } from "./stagger.js";
import { setTiming } from "./set-timing.js";
import { sequence } from "./sequence.js";
import { queryAnimatableTool } from "./query-animatable.js";
import { renderVariant } from "./render-variant.js";
import {
  ApplyBrandKitInput,
  ApplyIntentInput,
  ApplyLockManifestInput,
  CreateBlockInput,
  CreateSceneInput,
  GenerateAssetInput,
  QueryAnimatableInput,
  RenderVariantInput,
  SaveSceneInput,
  SequenceInput,
  SetPropertiesInput,
  SetTimingInput,
  StaggerInput,
} from "./_schemas.js";
import { FORBIDDEN_TOOL_NAMES } from "./save-scene.js";

export type ToolContextResolver = () => CallerContext;

let contextResolver: ToolContextResolver = () => ({
  tenantId: "dev-tenant",
  userId: "dev-user",
  role: "creator",
});

export function setToolContextResolver(resolver: ToolContextResolver): void {
  contextResolver = resolver;
}

function wrapTool<S extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  schema: S,
  handler: (ctx: CallerContext, input: z.infer<S>) => Promise<unknown>,
): ToolRegistration {
  return {
    name,
    description: `DEPT Canvas tool: ${name}`,
    inputSchema: schema.shape,
    handler: async (input) => {
      const ctx = contextResolver();
      const parsed = schema.parse(input);
      const result = await handler(ctx, parsed);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as Record<string, unknown>,
      };
    },
  };
}

export function buildCoreTools(): ToolRegistration[] {
  return [
    wrapTool("create_scene", CreateSceneInput, createScene),
    wrapTool("create_block", CreateBlockInput, createBlock),
    wrapTool("set_properties", SetPropertiesInput, setProperties),
    wrapTool("apply_brand_kit", ApplyBrandKitInput, applyBrandKit),
    wrapTool("apply_lock_manifest", ApplyLockManifestInput, applyLockManifest),
    wrapTool("save_scene", SaveSceneInput, saveScene),
    wrapTool("generate_asset", GenerateAssetInput, generateAsset),
    wrapTool("apply_intent", ApplyIntentInput, applyIntent),
    wrapTool("stagger", StaggerInput, stagger),
    wrapTool("set_timing", SetTimingInput, setTiming),
    wrapTool("sequence", SequenceInput, sequence),
    wrapTool("query_animatable", QueryAnimatableInput, queryAnimatableTool),
    wrapTool("render_variant", RenderVariantInput, renderVariant),
  ];
}

export function assertNoForbiddenTools(toolNames: string[]): void {
  for (const forbidden of FORBIDDEN_TOOL_NAMES) {
    if (toolNames.includes(forbidden)) {
      throw new Error(`Forbidden tool registered: ${forbidden}`);
    }
  }
}

export const CORE_TOOL_NAMES = [
  "create_scene",
  "create_block",
  "set_properties",
  "apply_brand_kit",
  "apply_lock_manifest",
  "save_scene",
  "generate_asset",
  "render_variant",
] as const;
