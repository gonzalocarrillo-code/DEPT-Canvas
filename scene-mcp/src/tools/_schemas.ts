import { z } from "zod";

export const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number().default(1),
});

export const CreateSceneInput = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  layout: z
    .enum(["Free", "VerticalStack", "HorizontalStack", "DepthStack"])
    .default("Free"),
});

export const CreateSceneOutput = z.object({
  jobId: z.string(),
  sceneId: z.number(),
  pageId: z.number(),
});

export const CreateBlockInput = z.object({
  jobId: z.string(),
  parentId: z.number().int(),
  type: z.enum(["text", "graphic", "page"]),
  kind: z.string().optional(),
});

export const CreateBlockOutput = z.object({
  blockId: z.number(),
});

export const SetPropertiesInput = z.object({
  jobId: z.string(),
  blockId: z.number(),
  properties: z.array(
    z.object({
      key: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), ColorSchema]),
    }),
  ),
});

export const SetPropertiesOutput = z.object({
  applied: z.array(z.string()),
});

export const ApplyBrandKitInput = z.object({
  jobId: z.string(),
  brandKit: z.record(z.string(), z.unknown()),
});

export const ApplyBrandKitOutput = z.object({
  applied: z.boolean(),
});

export const ApplyLockManifestInput = z.object({
  jobId: z.string(),
  manifest: z.object({
    templateId: z.string(),
    version: z.string(),
    frozen: z.array(
      z.object({
        selector: z.object({
          blockId: z.number().optional(),
          kind: z.string().optional(),
          name: z.string().optional(),
          role: z.string().optional(),
        }),
        properties: z.union([z.array(z.string()), z.literal("*")]),
      }),
    ),
  }),
});

export const ApplyLockManifestOutput = z.object({
  templateId: z.string(),
  frozenCount: z.number(),
});

export const SaveSceneInput = z.object({
  jobId: z.string(),
  archive: z.boolean().default(false),
});

export const SaveSceneOutput = z.object({
  sceneRef: z.string(),
});

export const GenerateAssetInput = z.object({
  jobId: z.string(),
  targetBlockId: z.number().int().optional(),
  assetType: z.enum(["copy", "image", "background"]),
  prompt: z.string(),
  tone: z.array(z.string()).optional(),
  characterLimit: z.number().int().optional(),
  negativeKeywords: z.array(z.string()).optional(),
  referenceImageRefs: z.array(z.string()).optional(),
  styleStrength: z.number().min(0).max(1).optional(),
});

export const GenerateAssetOutput = z.object({
  realizedAsFill: z.literal(true),
  appliedToBlockId: z.number().optional(),
  assetRef: z.string().optional(),
  checkpoints: z.object({
    input: z.enum(["pass", "block"]),
    asset: z.enum(["pass", "block"]),
    brandLegal: z.enum(["pass", "block"]),
  }),
  auditId: z.string(),
});

export type CreateSceneInput = z.infer<typeof CreateSceneInput>;
export type CreateBlockInput = z.infer<typeof CreateBlockInput>;
export type SetPropertiesInput = z.infer<typeof SetPropertiesInput>;
export type SaveSceneInput = z.infer<typeof SaveSceneInput>;
