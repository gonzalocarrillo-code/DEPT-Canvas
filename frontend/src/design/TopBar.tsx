import { Button, escapeHtml } from "./Button.js";

export interface TopBarAction {
  readonly label: string;
  readonly icon: string;
  readonly tone?: "primary" | "secondary" | "ghost";
}

export interface TopBarProps {
  readonly projectPath: readonly string[];
  readonly saveState: string;
  readonly collaborators: readonly string[];
  readonly actions: readonly TopBarAction[];
}

export function TopBar({
  projectPath,
  saveState,
  collaborators,
  actions,
}: TopBarProps): string {
  const breadcrumb = projectPath.map(escapeHtml).join(" / ");
  const collaboratorList = collaborators
    .map((collaborator) => `<span class="dc-avatar">${escapeHtml(collaborator)}</span>`)
    .join("");
  const actionButtons = actions
    .map((action) =>
      Button({
        label: action.label,
        icon: action.icon,
        tone: action.tone ?? "secondary",
      }),
    )
    .join("");

  return `<header class="dc-top-bar" data-region="top-bar">
    <div class="dc-top-bar__project">
      <span class="dc-breadcrumb">${breadcrumb}</span>
      <span class="dc-save-state">${escapeHtml(saveState)}</span>
    </div>
    <div class="dc-top-bar__actions">
      <div class="dc-collaborators" aria-label="Collaborators">${collaboratorList}</div>
      ${actionButtons}
      ${Button({ label: "Account", icon: "U", tone: "icon" })}
    </div>
  </header>`;
}
