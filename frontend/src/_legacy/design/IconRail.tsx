import { Button, escapeHtml } from "./Button.js";

export interface IconRailItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
}

export const DEFAULT_ICON_RAIL_ITEMS: readonly IconRailItem[] = [
  { id: "layers", label: "Layers", icon: "L" },
  { id: "assets", label: "Assets", icon: "A" },
  { id: "brand-kit", label: "Brand kit", icon: "B" },
  { id: "text", label: "Text", icon: "T" },
  { id: "shapes", label: "Shapes", icon: "S" },
  { id: "settings", label: "Settings", icon: "G" },
];

export interface IconRailProps {
  readonly activeItemId: string;
  readonly items?: readonly IconRailItem[];
}

export function IconRail({
  activeItemId,
  items = DEFAULT_ICON_RAIL_ITEMS,
}: IconRailProps): string {
  const renderedItems = items
    .map((item) => {
      const selected = item.id === activeItemId;
      return `<li class="dc-icon-rail__item" data-rail-item="${escapeHtml(item.id)}">${Button({
        label: item.label,
        icon: item.icon,
        tone: "icon",
        pressed: selected,
      })}</li>`;
    })
    .join("");

  return `<nav class="dc-icon-rail" data-region="left-icon-rail" aria-label="Primary tools">
    <ul>${renderedItems}</ul>
  </nav>`;
}
