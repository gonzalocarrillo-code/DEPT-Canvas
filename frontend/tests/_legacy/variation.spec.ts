import { describe, expect, it } from "vitest";
import {
  estimateVariationBatch,
  formatUsd,
} from "../src/variation/CostEstimate.js";
import {
  defaultStudioState,
  renderStudioScreen,
} from "../src/variation/StudioScreen.js";
import {
  approveAll,
  canPushToDelivery,
  renderReviewGrid,
  type BatchReviewItem,
} from "../src/variation/ReviewGrid.js";

const completedItems: readonly BatchReviewItem[] = [
  { id: "v-001", name: "Launch 1:1", size: "1:1", durationSec: 6, status: "done" },
  { id: "v-002", name: "Launch 9:16", size: "9:16", durationSec: 6, status: "done" },
];

describe("P3-T4 variation studio", () => {
  it("shows count and estimated cost before generate", () => {
    const estimate = estimateVariationBatch(defaultStudioState.matrix);
    const markup = renderStudioScreen();

    expect(estimate.generationCount).toBe(4);
    expect(estimate.count).toBe(16);
    expect(estimate.etaSec).toBe(80);
    expect(estimate.outputs).toHaveLength(16);
    expect(markup).toContain('data-generation-gate="before-generate"');
    expect(markup).toContain(`data-estimate-eta-sec="${estimate.etaSec}"`);
    expect(markup).toContain(`<span class="dc-estimate-value">${estimate.count}</span>`);
    expect(markup).toContain(`<span class="dc-estimate-value">${formatUsd(estimate.costUsd)}</span>`);
    expect(markup).toContain(`<span class="dc-estimate-value">${estimate.etaSec} sec</span>`);
    expect(markup.indexOf("estimated cost")).toBeLessThan(markup.indexOf("Generate batch"));
  });

  it("disables generate until the estimate is visible", () => {
    const waitingForEstimate = renderStudioScreen({
      ...defaultStudioState,
      estimateVisible: false,
    });
    const readyToGenerate = renderStudioScreen({
      ...defaultStudioState,
      estimateVisible: true,
    });

    expect(waitingForEstimate).toContain('data-generation-gate="estimate-required"');
    expect(waitingForEstimate).toContain('aria-label="Generate batch" disabled');
    expect(readyToGenerate).toContain('data-generation-gate="before-generate"');
    expect(readyToGenerate).not.toContain('aria-label="Generate batch" disabled');
  });

  it("keeps push-to-delivery disabled until an approver approves", () => {
    const waitingForApprover = {
      items: completedItems,
      approverApproved: false,
    };
    const approved = {
      items: completedItems,
      approverApproved: true,
    };

    expect(approveAll(waitingForApprover).approverApproved).toBe(true);
    expect(canPushToDelivery(waitingForApprover)).toBe(false);
    expect(renderReviewGrid(waitingForApprover)).toContain('data-review-action="approve-all"');
    expect(renderReviewGrid(waitingForApprover)).toContain('data-approve-all-enabled="true"');
    expect(renderReviewGrid(waitingForApprover)).toContain(
      'aria-label="Push to delivery" disabled',
    );
    expect(renderReviewGrid(waitingForApprover)).toContain(
      'data-delivery-gate="approver-approval">Push requires approver approval',
    );

    expect(canPushToDelivery(approved)).toBe(true);
    expect(renderReviewGrid(approved)).toContain(
      'data-delivery-gate="approver-approval">Approved for delivery',
    );
    expect(renderReviewGrid(approved)).not.toContain(
      'aria-label="Push to delivery" disabled',
    );
  });

  it("renders layer states, batch statuses, and review actions", () => {
    const markup = renderStudioScreen();

    expect(markup).toContain("AI-variable");
    expect(markup).toContain("Fixed");
    expect(markup).toContain("Locked");
    expect(markup).toContain('data-review-status="done"');
    expect(markup).toContain('data-review-status="rendering"');
    expect(markup).toContain('data-review-status="queued"');
    expect(markup).toContain("Spot-check");
    expect(markup).toContain("Approve all");
    expect(markup).toContain("Reject");
  });
});
