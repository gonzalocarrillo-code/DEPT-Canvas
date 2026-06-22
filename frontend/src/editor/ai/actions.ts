export type AiSelectionRole = "brand" | "copy" | "image" | "background";

export type AiSelectionType = "brand" | "text" | "image" | "background";

export type AiActionId =
  | "replace-background"
  | "copy-variants"
  | "cut-out-subject"
  | "animate-to-video";

export type GenerateAssetToolName = "generate_asset";

export interface AiAction {
  readonly id: AiActionId;
  readonly label: string;
  readonly targetSelection: AiSelectionType;
  readonly tool: GenerateAssetToolName;
}

export interface SimpleGenerationControls {
  readonly prompt: string;
  readonly tone: "direct" | "warm" | "premium" | "playful";
}

export interface AdvancedGenerationControls {
  readonly guidance: string;
  readonly charCap: number;
  readonly negativeKeywords: string;
  readonly referencePins: readonly string[];
  readonly stylePins: readonly string[];
}

export interface GenerateAssetRequest {
  readonly tool: GenerateAssetToolName;
  readonly input: {
    readonly layerId: string;
    readonly action: AiActionId;
    readonly prompt: string;
    readonly tone: SimpleGenerationControls["tone"];
    readonly guidance: string;
    readonly charCap: number;
    readonly negativeKeywords: string;
    readonly referencePins: readonly string[];
    readonly stylePins: readonly string[];
  };
}

export const AI_ACTIONS_BY_SELECTION: Record<AiSelectionRole, readonly AiAction[]> = {
  brand: [],
  background: [
    {
      id: "replace-background",
      label: "Replace background",
      targetSelection: "background",
      tool: "generate_asset",
    },
  ],
  copy: [
    {
      id: "copy-variants",
      label: "Copy variants",
      targetSelection: "text",
      tool: "generate_asset",
    },
  ],
  image: [
    {
      id: "cut-out-subject",
      label: "Cut out subject",
      targetSelection: "image",
      tool: "generate_asset",
    },
    {
      id: "animate-to-video",
      label: "Animate to video",
      targetSelection: "image",
      tool: "generate_asset",
    },
  ],
};

export function selectionTypeForRole(role: AiSelectionRole): AiSelectionType {
  return role === "copy" ? "text" : role;
}

export function actionsForSelection(role: AiSelectionRole): readonly AiAction[] {
  return AI_ACTIONS_BY_SELECTION[role];
}

export function buildGenerateAssetRequest({
  layerId,
  action,
  simple,
  advanced,
}: {
  readonly layerId: string;
  readonly action: AiActionId;
  readonly simple: SimpleGenerationControls;
  readonly advanced: AdvancedGenerationControls;
}): GenerateAssetRequest {
  return {
    tool: "generate_asset",
    input: {
      layerId,
      action,
      prompt: simple.prompt,
      tone: simple.tone,
      guidance: advanced.guidance,
      charCap: advanced.charCap,
      negativeKeywords: advanced.negativeKeywords,
      referencePins: advanced.referencePins,
      stylePins: advanced.stylePins,
    },
  };
}
