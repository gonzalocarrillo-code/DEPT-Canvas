import { Button, escapeHtml } from "../design/Button.js";

export type LayerVariationState = "ai-variable" | "fixed" | "locked";

export interface VariationLayer {
  readonly id: number;
  readonly name: string;
  readonly role: string;
  readonly state: LayerVariationState;
}

export interface VariationAxis {
  readonly id: string;
  readonly label: string;
  readonly values: readonly string[];
}

export interface AxisEditorProps {
  readonly layers: readonly VariationLayer[];
  readonly axes: readonly VariationAxis[];
}

const LAYER_STATE_LABELS: Record<LayerVariationState, string> = {
  "ai-variable": "AI-variable",
  fixed: "Fixed",
  locked: "Locked",
};

export function renderAxisEditor({ layers, axes }: AxisEditorProps): string {
  const renderedLayers = layers.map(renderLayerRow).join("");
  const renderedAxes = axes.map(renderAxis).join("");

  return `<div class="dc-axis-editor" aria-label="Variation setup">
    <section aria-label="Layer variation states">
      <h3>Layers</h3>
      <ol class="dc-layer-list">${renderedLayers}</ol>
    </section>
    <section aria-label="Variation axes">
      <h3>Axes</h3>
      <div class="dc-axis-list">${renderedAxes}</div>
    </section>
  </div>`;
}

export function renderLayerStateControls(activeState: LayerVariationState): string {
  return (Object.keys(LAYER_STATE_LABELS) as LayerVariationState[])
    .map((state) =>
      Button({
        label: LAYER_STATE_LABELS[state],
        tone: state === activeState ? "ghost" : "secondary",
        pressed: state === activeState,
        disabled: activeState === "locked" && state !== "locked",
      }),
    )
    .join("");
}

function renderLayerRow(layer: VariationLayer): string {
  return `<li data-layer-id="${escapeHtml(String(layer.id))}" data-layer-state="${escapeHtml(layer.state)}">
    <div>
      <strong>${escapeHtml(layer.name)}</strong>
      <span>${escapeHtml(layer.role)}</span>
    </div>
    <div class="dc-segmented-control" aria-label="${escapeHtml(layer.name)} state">
      ${renderLayerStateControls(layer.state)}
    </div>
  </li>`;
}

function renderAxis(axis: VariationAxis): string {
  const values = axis.values
    .map((value) => `<span class="dc-axis-pill">${escapeHtml(value)}</span>`)
    .join("");

  return `<fieldset class="dc-axis" data-axis-id="${escapeHtml(axis.id)}">
    <legend>${escapeHtml(axis.label)}</legend>
    <div>${values}</div>
  </fieldset>`;
}
