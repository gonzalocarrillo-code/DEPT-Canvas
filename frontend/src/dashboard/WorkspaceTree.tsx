import { escapeHtml } from "../design/Button.js";
import { Panel } from "../design/Panel.js";
import type { DashboardWorkspace } from "./DashboardScreen.js";

export interface WorkspaceTreeProps {
  readonly workspaces: readonly DashboardWorkspace[];
  readonly activeWorkspaceId: string | "all";
}

function countWorkspaceAssets(workspace: DashboardWorkspace): number {
  return workspace.projects.reduce((count, project) => count + project.assets.length, 0);
}

export function WorkspaceTree({
  workspaces,
  activeWorkspaceId,
}: WorkspaceTreeProps): string {
  const items = workspaces
    .map((workspace) => {
      const selected = activeWorkspaceId === workspace.id;
      const projectCount = workspace.projects.length;
      const assetCount = countWorkspaceAssets(workspace);

      return `<li class="dc-workspace-tree__item" data-workspace-id="${escapeHtml(workspace.id)}" data-active="${selected ? "true" : "false"}">
        <button type="button" aria-pressed="${selected ? "true" : "false"}">
          <span>
            <strong>${escapeHtml(workspace.name)}</strong>
            <small>${projectCount} projects</small>
          </span>
          <span>${assetCount}</span>
        </button>
      </li>`;
    })
    .join("");

  return Panel({
    region: "workspace-tree",
    title: "Brand workspaces",
    children: `<ol class="dc-workspace-tree">${items}</ol>`,
  });
}
