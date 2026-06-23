import { Button } from "../design/Button.js";
import { Panel } from "../design/Panel.js";
import {
  estimateVariationBatch,
  renderCostEstimate,
  type SizePreset,
  type VariationMatrix,
} from "./CostEstimate.js";
import {
  renderAxisEditor,
  type VariationAxis,
  type VariationLayer,
} from "./AxisEditor.js";
import {
  renderReviewGrid,
  type BatchReviewItem,
} from "./ReviewGrid.js";

export interface StudioScreenState {
  readonly layers: readonly VariationLayer[];
  readonly axes: readonly VariationAxis[];
  readonly matrix: VariationMatrix;
  readonly reviewItems: readonly BatchReviewItem[];
  readonly approverApproved: boolean;
  readonly estimateVisible: boolean;
}

export const DEFAULT_VARIATION_SIZES: readonly SizePreset[] = [
  { label: "1:1", width: 1080, height: 1080 },
  { label: "9:16", width: 1080, height: 1920 },
];

export const defaultStudioState: StudioScreenState = {
  layers: [
    { id: 1, name: "Logo", role: "Brand mark", state: "locked" },
    { id: 2, name: "Hero copy", role: "Message slot", state: "ai-variable" },
    { id: 3, name: "Background", role: "Generated fill", state: "ai-variable" },
    { id: 4, name: "CTA", role: "Offer lockup", state: "fixed" },
  ],
  axes: [
    { id: "size", label: "Size", values: DEFAULT_VARIATION_SIZES.map((size) => size.label) },
    { id: "duration", label: "Duration", values: ["6 sec", "15 sec"] },
    { id: "copy", label: "Copy", values: ["Launch", "Last chance"] },
    { id: "background", label: "Background", values: ["Studio", "Gradient-free product"] },
  ],
  matrix: {
    sizes: DEFAULT_VARIATION_SIZES,
    durationsSec: [6, 15],
    copyVariants: ["Launch", "Last chance"],
    backgrounds: ["Studio", "Gradient-free product"],
  },
  reviewItems: [
    { id: "v-001", name: "Launch 1:1", size: "1:1", durationSec: 6, status: "done" },
    { id: "v-002", name: "Launch 9:16", size: "9:16", durationSec: 6, status: "rendering" },
    { id: "v-003", name: "Last chance 1:1", size: "1:1", durationSec: 15, status: "queued" },
  ],
  approverApproved: false,
  estimateVisible: true,
};

export function renderStudioScreen(state: StudioScreenState = defaultStudioState): string {
  const estimate = estimateVariationBatch(state.matrix);
  const estimateMarkup = state.estimateVisible
    ? renderCostEstimate(estimate)
    : '<section class="dc-variation-estimate" data-generation-gate="estimate-required" data-estimate-visible="false" aria-label="Batch estimate">Estimate required before generate</section>';
  const setup = Panel({
    region: "variation-setup",
    title: "Variation studio",
    children: `${renderAxisEditor({ layers: state.layers, axes: state.axes })}
      ${estimateMarkup}
      <div class="dc-generation-actions">
        ${Button({ label: "Generate batch", tone: "primary", disabled: !state.estimateVisible })}
      </div>`,
  });
  const review = renderReviewGrid({
    items: state.reviewItems,
    approverApproved: state.approverApproved,
  });

  return `<main class="dc-variation-studio" data-screen="variation-studio">
    ${setup}
    ${review}
  </main>`;
}

export default renderStudioScreen;
