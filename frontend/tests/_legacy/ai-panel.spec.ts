import { describe, expect, it } from "vitest";
import {
  defaultEditorScreenState,
  renderEditorScreen,
} from "../src/editor/EditorScreen.js";
import type { EditorLayer } from "../src/editor/Timeline.js";
import {
  buildGenerateAssetRequest,
  type AdvancedGenerationControls,
} from "../src/editor/ai/actions.js";

function layer(overrides: Partial<EditorLayer> & Pick<EditorLayer, "id" | "role">): EditorLayer {
  return {
    name: overrides.id,
    locked: false,
    bars: [],
    ...overrides,
  };
}

describe("P3-T3 AI panel", () => {
  it("changes actions by selected layer type", () => {
    const textMarkup = renderEditorScreen({
      ...defaultEditorScreenState,
      selectedLayerId: "hero-copy",
    });
    expect(textMarkup).toContain('data-selection-type="text"');
    expect(textMarkup).toContain("Copy variants");
    expect(textMarkup).not.toContain("Replace background");
    expect(textMarkup).not.toContain("Cut out subject");

    const background = layer({
      id: "background",
      name: "Background",
      role: "background",
    });
    const backgroundMarkup = renderEditorScreen({
      ...defaultEditorScreenState,
      layers: [background, ...defaultEditorScreenState.layers],
      selectedLayerId: "background",
    });
    expect(backgroundMarkup).toContain('data-selection-type="background"');
    expect(backgroundMarkup).toContain("Replace background");
    expect(backgroundMarkup).not.toContain("Copy variants");

    const imageMarkup = renderEditorScreen({
      ...defaultEditorScreenState,
      selectedLayerId: "product-image",
    });
    expect(imageMarkup).toContain('data-selection-type="image"');
    expect(imageMarkup).toContain("Cut out subject");
    expect(imageMarkup).toContain("Animate to video");
    expect(imageMarkup).not.toContain("Replace background");
  });

  it("greys out locked layer AI actions with a lock indicator", () => {
    const lockedText = layer({
      id: "locked-copy",
      name: "Locked copy",
      role: "copy",
      locked: true,
    });
    const markup = renderEditorScreen({
      ...defaultEditorScreenState,
      layers: [lockedText],
      selectedLayerId: "locked-copy",
    });

    expect(markup).toContain('data-locked="true"');
    expect(markup).toContain('class="dc-ai-action dc-ai-action--locked"');
    expect(markup).toContain('data-ai-action="copy-variants" data-ai-action-disabled="true"');
    expect(markup).toContain('data-lock-reflects-server="true"');
    expect(markup).toContain('data-lock-indicator="server-lock"');
    expect(markup).toContain('data-tool="generate_asset"');
    expect(markup).toContain("disabled");
  });

  it("sends advanced character cap to generate_asset", () => {
    const advanced: AdvancedGenerationControls = {
      ...defaultEditorScreenState.aiAdvancedControls,
      charCap: 42,
    };
    const markup = renderEditorScreen({
      ...defaultEditorScreenState,
      aiAdvancedControls: advanced,
      selectedLayerId: "hero-copy",
    });
    const request = buildGenerateAssetRequest({
      layerId: "hero-copy",
      action: "copy-variants",
      simple: defaultEditorScreenState.aiSimpleControls,
      advanced,
    });

    expect(markup).toContain('data-tool="generate_asset"');
    expect(markup).toContain('data-generate-asset-char-cap="42"');
    expect(request.tool).toBe("generate_asset");
    expect(request.input.charCap).toBe(42);
  });
});
