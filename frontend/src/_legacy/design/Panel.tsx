import { escapeHtml } from "./Button.js";

export interface PanelProps {
  readonly region: string;
  readonly title: string;
  readonly children?: string;
  readonly collapsed?: boolean;
}

export function Panel({
  region,
  title,
  children = "",
  collapsed = false,
}: PanelProps): string {
  const stateAttribute = collapsed ? ' data-collapsed="true"' : ' data-collapsed="false"';
  const hiddenAttribute = collapsed ? ' aria-hidden="true"' : "";

  return `<section class="dc-panel" data-region="${escapeHtml(region)}"${stateAttribute}${hiddenAttribute} aria-label="${escapeHtml(title)}">
    <header class="dc-panel__header">
      <h2>${escapeHtml(title)}</h2>
    </header>
    <div class="dc-panel__body">${children}</div>
  </section>`;
}
