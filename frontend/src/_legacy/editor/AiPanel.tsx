import { escapeHtml } from "../design/Button.js";
import type { EditorLayer } from "./Timeline.js";
import { renderAdvancedControls } from "./ai/AdvancedControls.js";
import {
  actionsForSelection,
  buildGenerateAssetRequest,
  selectionTypeForRole,
  type AdvancedGenerationControls,
  type AiAction,
  type SimpleGenerationControls,
} from "./ai/actions.js";
import { renderSimpleControls } from "./ai/SimpleControls.js";

export interface AiPanelState {
  readonly selectedLayer: EditorLayer;
  readonly simple: SimpleGenerationControls;
  readonly advanced: AdvancedGenerationControls;
}

function renderActionButton(
  action: AiAction,
  layer: EditorLayer,
  simple: SimpleGenerationControls,
  advanced: AdvancedGenerationControls,
): string {
  const disabled = layer.locked;
  const disabledAttribute = disabled ? " disabled aria-disabled=\"true\"" : "";
  const request = buildGenerateAssetRequest({
    layerId: layer.id,
    action: action.id,
    simple,
    advanced,
  });
  const lockIndicator = disabled
    ? '<span class="dc-ai-action__lock" data-lock-indicator="server-lock">Locked</span>'
    : "";

  return `<li class="dc-ai-action${disabled ? " dc-ai-action--locked" : ""}" data-ai-action="${escapeHtml(action.id)}" data-ai-action-disabled="${disabled ? "true" : "false"}" data-lock-reflects-server="${disabled ? "true" : "false"}">
    <button class="dc-button dc-button--secondary" type="button" data-tool="${request.tool}" data-generate-asset-action="${escapeHtml(action.id)}" data-layer-id="${escapeHtml(layer.id)}" data-generate-asset-char-cap="${request.input.charCap}"${disabledAttribute}>
      <span>${escapeHtml(action.label)}</span>
    </button>
    ${lockIndicator}
  </li>`;
}

function renderActions(
  layer: EditorLayer,
  simple: SimpleGenerationControls,
  advanced: AdvancedGenerationControls,
): string {
  const actions = actionsForSelection(layer.role);
  const items = actions
    .map((action) => renderActionButton(action, layer, simple, advanced))
    .join("");
  const emptyState = actions.length === 0
    ? '<li class="dc-ai-action dc-ai-action--empty">No AI action for this layer type</li>'
    : "";

  return `<ul class="dc-ai-actions" aria-label="AI actions">${items}${emptyState}</ul>`;
}

function renderLayerProperties(layer: EditorLayer): string {
  const motionLabels = layer.bars.map((bar) => bar.label).join(", ") || "None";

  return `<div class="dc-property-group dc-ai-properties" aria-label="Selected layer properties">
    <h3>Layer properties</h3>
    <label><span>Name</span><input value="${escapeHtml(layer.name)}" readonly /></label>
    <label><span>Type</span><input value="${escapeHtml(selectionTypeForRole(layer.role))}" readonly /></label>
    <label><span>Lock state</span><input value="${layer.locked ? "Locked" : "Editable"}" readonly /></label>
    <label><span>Motion</span><input value="${escapeHtml(motionLabels)}" readonly /></label>
  </div>`;
}

export function renderAiPanel({
  selectedLayer,
  simple,
  advanced,
}: AiPanelState): string {
  const selectionType = selectionTypeForRole(selectedLayer.role);
  const lockBadge = selectedLayer.locked
    ? '<span class="dc-lock-badge" data-lock-indicator="server-lock">Locked</span>'
    : "";

  return `<div class="dc-ai-panel" data-selection-type="${selectionType}" data-selected-layer-id="${escapeHtml(selectedLayer.id)}" data-locked="${selectedLayer.locked ? "true" : "false"}">
    <header class="dc-ai-panel__header">
      <div>
        <p class="dc-kicker">AI assist</p>
        <h3>${escapeHtml(selectedLayer.name)}</h3>
      </div>
      ${lockBadge}
    </header>
    <form class="dc-ai-form" data-tool="generate_asset" data-lock-source="server">
      ${renderActions(selectedLayer, simple, advanced)}
      ${renderSimpleControls(simple)}
      ${renderAdvancedControls(advanced)}
    </form>
    ${renderLayerProperties(selectedLayer)}
  </div>`;
}
