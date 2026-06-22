import { describe, expect, it } from "vitest";
import {
  createCesdkRuntimeConfig,
  wireCesdkLayerSelection,
} from "../src/editor/CesdkCanvas.js";
import {
  defaultEditorScreenState,
  renderEditorScreen,
} from "../src/editor/EditorScreen.js";

describe("P3-T2 editor", () => {
  it("reveals the Tier-1 preset timeline in Animate mode", () => {
    const markup = renderEditorScreen({
      ...defaultEditorScreenState,
      mode: "animate",
    });

    expect(markup).toContain('data-region="bottom-timeline" data-collapsed="false"');
    expect(markup).toContain('data-motion-tier="1"');
    expect(markup).toContain('data-preset-kind="in"');
    expect(markup).toContain('data-preset-kind="loop"');
    expect(markup).toContain('data-preset-kind="out"');
    expect(markup).toContain('data-stagger-step="0.12"');
    expect(markup).toContain('data-scrubber="true"');
    expect(markup.toLowerCase()).not.toContain("keyframe");
    expect(markup.toLowerCase()).not.toContain("speed graph");
  });

  it("keeps the timeline hidden in Design mode", () => {
    const markup = renderEditorScreen({
      ...defaultEditorScreenState,
      mode: "design",
    });

    expect(markup).toContain('data-editor-mode="design"');
    expect(markup).toContain('data-region="bottom-timeline" data-collapsed="true"');
    expect(markup).not.toContain('data-motion-tier="1"');
  });

  it("shows lock badges for locked layers", () => {
    const markup = renderEditorScreen();

    expect(markup).toContain('data-layer-id="logo" data-locked="true"');
    expect(markup).toContain('<span class="dc-lock-badge">Locked</span>');
  });

  it("reframes the same scene when the format changes", () => {
    const square = renderEditorScreen({
      ...defaultEditorScreenState,
      activeFormat: "1:1",
      sceneRef: "shared-scene.scene",
    });
    const vertical = renderEditorScreen({
      ...defaultEditorScreenState,
      activeFormat: "9:16",
      sceneRef: "shared-scene.scene",
    });

    expect(square).toContain('data-scene-ref="shared-scene.scene"');
    expect(vertical).toContain('data-scene-ref="shared-scene.scene"');
    expect(square).toContain('data-license-source="VITE_CESDK_LICENSE"');
    expect(square).toContain('data-format="1:1"');
    expect(vertical).toContain('data-format="9:16"');
    expect(square).toContain('data-format-width="1080" data-format-height="1080"');
    expect(vertical).toContain('data-format-width="1080" data-format-height="1920"');
    expect(square).not.toContain("CE.SDK editor");
  });

  it("uses runtime CE.SDK license config without hardcoding the key", () => {
    const config = createCesdkRuntimeConfig({
      VITE_CESDK_LICENSE: "runtime-license",
      VITE_IMGLY_LOCAL_ASSETS_URL: "/cesdk-assets",
    });

    expect(config.license).toBe("runtime-license");
    expect(config.baseURL).toBe("/cesdk-assets");
    expect(() => createCesdkRuntimeConfig({})).toThrow("VITE_CESDK_LICENSE");
  });

  it("bridges CE.SDK selection into selectedLayerId state", () => {
    const selectedLayerIds: string[] = [];
    const unsubscribe = () => selectedLayerIds.push("disposed");
    const bridge = wireCesdkLayerSelection({
      selectedLayerId: "hero-copy",
      layerBlockIds: {
        "hero-copy": "Hero copy",
        "product-image": "Product image",
      },
      cesdk: {
        engine: {
          block: {
            findAllSelected: () => [101],
            getName: () => "Product image",
            onSelectionChanged: (listener) => {
              listener();
              return unsubscribe;
            },
          },
        },
      },
      onSelectedLayerIdChange: (layerId) => selectedLayerIds.push(layerId),
    });
    const markup = renderEditorScreen({
      ...defaultEditorScreenState,
      selectedLayerId: "product-image",
    });

    expect(selectedLayerIds).toContain("product-image");
    expect(bridge.selectedLayerId).toBe("hero-copy");
    bridge.dispose();
    expect(selectedLayerIds).toContain("disposed");
    expect(markup).toContain('data-selected-layer-id="product-image"');
    expect(markup).toContain("<h3>Product image</h3>");
  });
});
