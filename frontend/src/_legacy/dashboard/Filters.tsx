import { Button, escapeHtml } from "../design/Button.js";
import type {
  DashboardAssetKind,
  DashboardFilterState,
  DashboardStatus,
  DashboardWorkspace,
} from "./DashboardScreen.js";

export interface FiltersProps {
  readonly filters: DashboardFilterState;
  readonly workspaces: readonly DashboardWorkspace[];
}

interface FilterOption<TValue extends string> {
  readonly label: string;
  readonly value: TValue;
}

const ASSET_KIND_OPTIONS: readonly FilterOption<DashboardAssetKind | "all">[] = [
  { label: "All assets", value: "all" },
  { label: "Masters", value: "master" },
  { label: "Templates", value: "template" },
  { label: "Variations", value: "variation" },
];

const STATUS_OPTIONS: readonly FilterOption<DashboardStatus | "all">[] = [
  { label: "All statuses", value: "all" },
  { label: "Active", value: "active" },
  { label: "In review", value: "review" },
  { label: "Approved", value: "approved" },
  { label: "Archived", value: "archived" },
];

function renderFilterGroup<TValue extends string>(
  label: string,
  currentValue: TValue,
  options: readonly FilterOption<TValue>[],
): string {
  const buttons = options
    .map((option) =>
      Button({
        label: option.label,
        pressed: option.value === currentValue,
        tone: "ghost",
      }).replace("<button", `<button data-filter-value="${escapeHtml(option.value)}"`),
    )
    .join("");

  return `<div class="dc-dashboard-filters__group" aria-label="${escapeHtml(label)}">
    <span>${escapeHtml(label)}</span>
    <div class="dc-dashboard-filters__options">${buttons}</div>
  </div>`;
}

export function Filters({ filters, workspaces }: FiltersProps): string {
  const workspaceOptions: readonly FilterOption<string>[] = [
    { label: "All workspaces", value: "all" },
    ...workspaces.map((workspace) => ({
      label: workspace.name,
      value: workspace.id,
    })),
  ];

  return `<section class="dc-dashboard-filters" aria-label="Filters">
    ${renderFilterGroup("Workspace", filters.workspaceId, workspaceOptions)}
    ${renderFilterGroup("Asset type", filters.assetKind, ASSET_KIND_OPTIONS)}
    ${renderFilterGroup("Status", filters.status, STATUS_OPTIONS)}
  </section>`;
}
