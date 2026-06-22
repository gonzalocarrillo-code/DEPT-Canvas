import { Button } from "../design/Button.js";
import { IconRail, type IconRailItem } from "../design/IconRail.js";
import { Panel } from "../design/Panel.js";
import { TopBar, type TopBarAction } from "../design/TopBar.js";

export type ShellRegion =
  | "top-bar"
  | "left-icon-rail"
  | "left-panel"
  | "center-canvas"
  | "right-panel"
  | "bottom-timeline";

export interface ShellState {
  readonly projectPath: readonly string[];
  readonly saveState: string;
  readonly collaborators: readonly string[];
  readonly topBarActions: readonly TopBarAction[];
  readonly railItems: readonly IconRailItem[];
  readonly activeRailItemId: string;
  readonly timelineCollapsed: boolean;
}

export const SHELL_REGIONS: readonly ShellRegion[] = [
  "top-bar",
  "left-icon-rail",
  "left-panel",
  "center-canvas",
  "right-panel",
  "bottom-timeline",
];

export const SHELL_TIMELINE_DEFAULT_COLLAPSED = true;

export const SHELL_TEXT_LABELS: readonly string[] = [
  "Summer launch",
  "Workspace",
  "Saved",
  "Preview",
  "Export",
  "Account",
  "Primary tools",
  "Collaborators",
  "Layers",
  "Assets",
  "Brand kit",
  "Text",
  "Shapes",
  "Settings",
  "Design",
  "Canvas",
  "Logo",
  "Locked",
  "Hero copy",
  "Product image",
  "AI assist",
  "Properties",
  "Opacity",
  "Blend",
  "Normal",
  "Timeline",
];

export const defaultShellState: ShellState = {
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
  timelineCollapsed: SHELL_TIMELINE_DEFAULT_COLLAPSED,
};

export function renderShell(state: ShellState = defaultShellState): string {
  const leftPanel = Panel({
    region: "left-panel",
    title: "Layers",
    children: `<ol class="dc-layer-list">
      <li><span>Logo</span><span class="dc-lock-badge">Locked</span></li>
      <li><span>Hero copy</span></li>
      <li><span>Product image</span></li>
    </ol>`,
  });

  const canvas = `<main class="dc-canvas-stage" data-region="center-canvas" aria-label="Canvas">
    <div class="dc-canvas-toolbar">
      ${Button({ label: "Design", pressed: true, tone: "ghost" })}
    </div>
    <div class="dc-canvas-surface">
      <div class="dc-artboard">
        <span class="dc-artboard__label">Canvas</span>
      </div>
    </div>
  </main>`;

  const rightPanel = Panel({
    region: "right-panel",
    title: "AI assist",
    children: `<div class="dc-property-group" aria-label="Properties">
      <h3>Properties</h3>
      <label><span>Opacity</span><input value="100%" readonly /></label>
      <label><span>Blend</span><input value="Normal" readonly /></label>
    </div>`,
  });

  const timeline = Panel({
    region: "bottom-timeline",
    title: "Timeline",
    collapsed: state.timelineCollapsed,
  });

  return `<div class="dc-shell">
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

export default renderShell;
