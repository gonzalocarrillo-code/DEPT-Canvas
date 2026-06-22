import { escapeHtml } from "../design/Button.js";
import { IconRail, type IconRailItem } from "../design/IconRail.js";
import { Panel } from "../design/Panel.js";
import { TopBar, type TopBarAction } from "../design/TopBar.js";
import { renderAiPanel } from "./AiPanel.js";
import { DEFAULT_ADVANCED_CONTROLS } from "./ai/AdvancedControls.js";
import { type AdvancedGenerationControls, type SimpleGenerationControls } from "./ai/actions.js";
import { DEFAULT_SIMPLE_CONTROLS } from "./ai/SimpleControls.js";
import { renderCesdkCanvas } from "./CesdkCanvas.js";
import { renderDesignAnimateToggle, type EditorMode } from "./DesignAnimateToggle.js";
import { type CanvasFormatId, renderFormatSwitcher } from "./FormatSwitcher.js";
import { DEFAULT_TIMELINE_STATE, type EditorLayer, type TimelineState, renderTimeline } from "./Timeline.js";

export interface EditorScreenState {
  readonly mode: EditorMode;
  readonly activeFormat: CanvasFormatId;
  readonly sceneRef: string;
  readonly projectPath: readonly string[];
  readonly saveState: string;
  readonly collaborators: readonly string[];
  readonly topBarActions: readonly TopBarAction[];
  readonly railItems: readonly IconRailItem[];
  readonly activeRailItemId: string;
  readonly layers: readonly EditorLayer[];
  readonly selectedLayerId: string;
  readonly aiSimpleControls: SimpleGenerationControls;
  readonly aiAdvancedControls: AdvancedGenerationControls;
  readonly timeline: TimelineState;
}

export const defaultEditorScreenState: EditorScreenState = {
  mode: "design",
  activeFormat: "16:9",
  sceneRef: "summer-launch-master.scene",
  projectPath: ["Workspace", "Summer launch"],
  saveState: "Saved",
  collaborators: ["GC", "AM"],
  topBarActions: [
    { label: "Preview", icon: "P", tone: "secondary" },
    { label: "Export", icon: "E", tone: "primary" },
  ],
  railItems: [
    { id: "layers", label: "Layers", icon: "L" },
    { id: "assets", label: "Assets", icon: "A" },
    { id: "brand-kit", label: "Brand kit", icon: "B" },
    { id: "text", label: "Text", icon: "T" },
    { id: "shapes", label: "Shapes", icon: "S" },
    { id: "settings", label: "Settings", icon: "G" },
  ],
  activeRailItemId: "layers",
  layers: DEFAULT_TIMELINE_STATE.layers,
  selectedLayerId: "hero-copy",
  aiSimpleControls: DEFAULT_SIMPLE_CONTROLS,
  aiAdvancedControls: DEFAULT_ADVANCED_CONTROLS,
  timeline: DEFAULT_TIMELINE_STATE,
};

function findSelectedLayer(
  layers: readonly EditorLayer[],
  selectedLayerId: string,
): EditorLayer {
  return layers.find((layer) => layer.id === selectedLayerId) ?? layers[0];
}

function renderLayerList(
  layers: readonly EditorLayer[],
  selectedLayerId: string,
): string {
  const items = layers
    .map((layer) => {
      const lockBadge = layer.locked ? '<span class="dc-lock-badge">Locked</span>' : "";
      return `<li data-layer-id="${escapeHtml(layer.id)}" data-locked="${layer.locked ? "true" : "false"}" data-selected="${layer.id === selectedLayerId ? "true" : "false"}">
        <span>${escapeHtml(layer.name)}</span>
        ${lockBadge}
      </li>`;
    })
    .join("");

  return `<ol class="dc-layer-list">${items}</ol>`;
}

export function renderEditorScreen(
  state: EditorScreenState = defaultEditorScreenState,
): string {
  const selectedLayer = findSelectedLayer(state.layers, state.selectedLayerId);
  const leftPanel = Panel({
    region: "left-panel",
    title: "Layers",
    children: renderLayerList(state.layers, selectedLayer.id),
  });
  const canvas = `<main class="dc-canvas-stage dc-editor-stage" data-region="center-canvas" aria-label="Canvas">
    <div class="dc-canvas-toolbar dc-editor-toolbar">
      ${renderDesignAnimateToggle({ mode: state.mode })}
      ${renderFormatSwitcher({ activeFormat: state.activeFormat })}
    </div>
    <div class="dc-canvas-surface">
      ${renderCesdkCanvas({
        activeFormat: state.activeFormat,
        sceneRef: state.sceneRef,
      })}
    </div>
  </main>`;
  const rightPanel = Panel({
    region: "right-panel",
    title: "AI assist",
    children: renderAiPanel({
      selectedLayer,
      simple: state.aiSimpleControls,
      advanced: state.aiAdvancedControls,
    }),
  });
  const timeline = Panel({
    region: "bottom-timeline",
    title: "Timeline",
    collapsed: state.mode === "design",
    children: state.mode === "animate" ? renderTimeline(state.timeline) : "",
  });

  return `<div class="dc-shell dc-editor-screen" data-editor-mode="${state.mode}">
    ${TopBar({
      projectPath: state.projectPath,
      saveState: state.saveState,
      collaborators: state.collaborators,
      actions: state.topBarActions,
    })}
    <div class="dc-shell__body">
      ${IconRail({ activeItemId: state.activeRailItemId, items: state.railItems })}
      ${leftPanel}
      ${canvas}
      ${rightPanel}
    </div>
    ${timeline}
  </div>`;
}

export default renderEditorScreen;
