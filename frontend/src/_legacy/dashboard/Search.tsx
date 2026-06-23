import { escapeHtml } from "../design/Button.js";
import type { DashboardSearchState } from "./DashboardScreen.js";

export interface SearchProps {
  readonly search: DashboardSearchState;
  readonly resultCount: number;
  readonly masterResultCount: number;
  readonly maxInteractions: number;
}

export function Search({
  search,
  resultCount,
  masterResultCount,
  maxInteractions,
}: SearchProps): string {
  const query = escapeHtml(search.query);
  const resultLabel = resultCount === 1 ? "result" : "results";
  const masterLabel = masterResultCount === 1 ? "master" : "masters";

  return `<section class="dc-dashboard-search" aria-label="Search" data-max-interactions="${maxInteractions}">
    <label class="dc-dashboard-search__field">
      <span>Search</span>
      <input type="search" value="${query}" placeholder="Find a master, template, or variation" aria-label="Search projects" />
    </label>
    <div class="dc-dashboard-search__summary" aria-live="polite">
      <span>${resultCount} ${resultLabel}</span>
      <span>${masterResultCount} ${masterLabel}</span>
    </div>
  </section>`;
}
