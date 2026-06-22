import { Button, escapeHtml } from "../design/Button.js";

export type BatchReviewStatus = "done" | "rendering" | "queued";

export interface BatchReviewItem {
  readonly id: string;
  readonly name: string;
  readonly size: string;
  readonly durationSec: number;
  readonly status: BatchReviewStatus;
}

export interface ReviewGridState {
  readonly items: readonly BatchReviewItem[];
  readonly approverApproved: boolean;
}

const STATUS_LABELS: Record<BatchReviewStatus, string> = {
  done: "Done",
  rendering: "Rendering",
  queued: "Queued",
};

export function canPushToDelivery(state: ReviewGridState): boolean {
  return state.approverApproved && state.items.length > 0 && state.items.every((item) => item.status === "done");
}

export function renderReviewGrid(state: ReviewGridState): string {
  const rows = state.items.map(renderReviewRow).join("");
  const pushDisabled = !canPushToDelivery(state);

  return `<section class="dc-review-grid" aria-label="Batch review">
    <header class="dc-review-grid__header">
      <h2>Batch review</h2>
      <div class="dc-review-grid__actions">
        ${Button({ label: "Approve all", tone: "secondary" })}
        ${Button({ label: "Push to delivery", tone: "primary", disabled: pushDisabled })}
      </div>
    </header>
    <table>
      <thead>
        <tr>
          <th scope="col">Variant</th>
          <th scope="col">Size</th>
          <th scope="col">Duration</th>
          <th scope="col">Status</th>
          <th scope="col">Review</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="dc-delivery-gate" data-delivery-gate="approver-approval">${pushDisabled ? "Push requires approver approval" : "Approved for delivery"}</p>
  </section>`;
}

function renderReviewRow(item: BatchReviewItem): string {
  const rejectDisabled = item.status === "queued";

  return `<tr data-review-status="${escapeHtml(item.status)}">
    <td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(item.size)}</td>
    <td>${escapeHtml(String(item.durationSec))} sec</td>
    <td>${escapeHtml(STATUS_LABELS[item.status])}</td>
    <td>
      ${Button({ label: "Spot-check", tone: "secondary" })}
      ${Button({ label: "Reject", tone: "secondary", disabled: rejectDisabled })}
    </td>
  </tr>`;
}
