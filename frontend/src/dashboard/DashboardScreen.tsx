import { escapeHtml } from "../design/Button.js";
import { IconRail, type IconRailItem } from "../design/IconRail.js";
import { TopBar, type TopBarAction } from "../design/TopBar.js";
import { Filters } from "./Filters.js";
import { Search } from "./Search.js";
import { WorkspaceTree } from "./WorkspaceTree.js";

export type DashboardAssetKind = "master" | "template" | "variation";
export type DashboardStatus = "active" | "review" | "approved" | "archived";

export interface DashboardAsset {
  readonly id: string;
  readonly name: string;
  readonly kind: DashboardAssetKind;
  readonly status: DashboardStatus;
  readonly updatedLabel: string;
  readonly owner: string;
  readonly route: string;
  readonly tags: readonly string[];
  readonly templateName?: string;
  readonly variationCount?: number;
  readonly sizeLabels?: readonly string[];
}

export interface DashboardProject {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly assets: readonly DashboardAsset[];
}

export interface DashboardWorkspace {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly projects: readonly DashboardProject[];
}

export interface DashboardSearchState {
  readonly query: string;
}

export interface DashboardFilterState {
  readonly workspaceId: string | "all";
  readonly assetKind: DashboardAssetKind | "all";
  readonly status: DashboardStatus | "all";
}

export interface DashboardState {
  readonly workspaces: readonly DashboardWorkspace[];
  readonly recentAssetIds: readonly string[];
  readonly search: DashboardSearchState;
  readonly filters: DashboardFilterState;
}

export interface DashboardAssetResult {
  readonly workspace: DashboardWorkspace;
  readonly project: DashboardProject;
  readonly asset: DashboardAsset;
  readonly reachInteractions: number;
}

export interface DashboardSearchPath {
  readonly result: DashboardAssetResult;
  readonly interactions: number;
}

export type DashboardStateInput = Partial<
  Pick<DashboardState, "workspaces" | "recentAssetIds">
> & {
  readonly search?: Partial<DashboardSearchState>;
  readonly filters?: Partial<DashboardFilterState>;
};

export const DEFAULT_DASHBOARD_INTERACTION_LIMIT = 2;

const DASHBOARD_TOP_ACTIONS: readonly TopBarAction[] = [
  { label: "New project", icon: "N", tone: "primary" },
  { label: "Import", icon: "I", tone: "secondary" },
];

const DASHBOARD_RAIL_ITEMS: readonly IconRailItem[] = [
  { id: "projects", label: "Projects", icon: "P" },
  { id: "templates", label: "Templates", icon: "T" },
  { id: "reviews", label: "Reviews", icon: "R" },
  { id: "settings", label: "Settings", icon: "G" },
];

export const defaultDashboardState: DashboardState = {
  workspaces: [
    {
      id: "dept-energy",
      name: "DEPT Energy",
      brand: "DEPT Energy",
      projects: [
        {
          id: "summer-launch",
          name: "Summer launch",
          brand: "DEPT Energy",
          assets: [
            {
              id: "master-solar-hero",
              name: "Solar hero master",
              kind: "master",
              status: "active",
              updatedLabel: "Updated today",
              owner: "GC",
              route: "/workspaces/dept-energy/projects/summer-launch/masters/master-solar-hero",
              tags: ["solar", "hero", "summer"],
              templateName: "Hero launch template",
              variationCount: 24,
              sizeLabels: ["1:1", "9:16", "16:9"],
            },
            {
              id: "template-hero-launch",
              name: "Hero launch template",
              kind: "template",
              status: "approved",
              updatedLabel: "Updated yesterday",
              owner: "AM",
              route: "/workspaces/dept-energy/projects/summer-launch/templates/template-hero-launch",
              tags: ["template", "hero"],
              sizeLabels: ["1:1", "4:5"],
            },
            {
              id: "variation-solar-reels",
              name: "Solar hero reels cut",
              kind: "variation",
              status: "review",
              updatedLabel: "Rendered today",
              owner: "GC",
              route: "/workspaces/dept-energy/projects/summer-launch/variations/variation-solar-reels",
              tags: ["variation", "reels", "solar"],
              templateName: "Solar hero master",
              sizeLabels: ["9:16"],
            },
          ],
        },
        {
          id: "winter-retention",
          name: "Winter retention",
          brand: "DEPT Energy",
          assets: [
            {
              id: "master-heat-pump",
              name: "Heat pump upgrade master",
              kind: "master",
              status: "approved",
              updatedLabel: "Updated Monday",
              owner: "LS",
              route: "/workspaces/dept-energy/projects/winter-retention/masters/master-heat-pump",
              tags: ["winter", "upgrade"],
              templateName: "Offer grid template",
              variationCount: 18,
              sizeLabels: ["16:9", "4:5"],
            },
          ],
        },
      ],
    },
    {
      id: "northstar-retail",
      name: "Northstar Retail",
      brand: "Northstar",
      projects: [
        {
          id: "spring-drop",
          name: "Spring drop",
          brand: "Northstar",
          assets: [
            {
              id: "master-spring-lookbook",
              name: "Spring lookbook master",
              kind: "master",
              status: "active",
              updatedLabel: "Updated Friday",
              owner: "AK",
              route: "/workspaces/northstar-retail/projects/spring-drop/masters/master-spring-lookbook",
              tags: ["lookbook", "spring"],
              templateName: "Product carousel template",
              variationCount: 36,
              sizeLabels: ["1:1", "9:16", "4:5"],
            },
            {
              id: "variation-spring-feed",
              name: "Spring lookbook feed set",
              kind: "variation",
              status: "approved",
              updatedLabel: "Approved Friday",
              owner: "AK",
              route: "/workspaces/northstar-retail/projects/spring-drop/variations/variation-spring-feed",
              tags: ["variation", "feed"],
              templateName: "Spring lookbook master",
              sizeLabels: ["1:1"],
            },
          ],
        },
      ],
    },
  ],
  recentAssetIds: ["master-solar-hero", "variation-solar-reels", "master-spring-lookbook"],
  search: {
    query: "",
  },
  filters: {
    workspaceId: "all",
    assetKind: "all",
    status: "all",
  },
};

export function createDashboardState(input: DashboardStateInput = {}): DashboardState {
  return {
    workspaces: input.workspaces ?? defaultDashboardState.workspaces,
    recentAssetIds: input.recentAssetIds ?? defaultDashboardState.recentAssetIds,
    search: {
      ...defaultDashboardState.search,
      ...input.search,
    },
    filters: {
      ...defaultDashboardState.filters,
      ...input.filters,
    },
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function formatKind(kind: DashboardAssetKind): string {
  switch (kind) {
    case "master":
      return "Master";
    case "template":
      return "Template";
    case "variation":
      return "Variation";
  }
}

function formatStatus(status: DashboardStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "review":
      return "In review";
    case "approved":
      return "Approved";
    case "archived":
      return "Archived";
  }
}

function flattenDashboardAssets(state: DashboardState): readonly DashboardAssetResult[] {
  const queryActive = normalize(state.search.query).length > 0;
  const results: DashboardAssetResult[] = [];

  for (const workspace of state.workspaces) {
    for (const project of workspace.projects) {
      for (const asset of project.assets) {
        const recent = state.recentAssetIds.includes(asset.id);
        results.push({
          workspace,
          project,
          asset,
          reachInteractions: queryActive || !recent ? DEFAULT_DASHBOARD_INTERACTION_LIMIT : 1,
        });
      }
    }
  }

  return results;
}

function resultMatchesSearch(result: DashboardAssetResult, query: string): boolean {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [
    result.workspace.name,
    result.workspace.brand,
    result.project.name,
    result.project.brand,
    result.asset.name,
    result.asset.kind,
    result.asset.status,
    result.asset.owner,
    result.asset.templateName ?? "",
    ...result.asset.tags,
    ...(result.asset.sizeLabels ?? []),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedQuery);
}

function resultMatchesFilters(result: DashboardAssetResult, filters: DashboardFilterState): boolean {
  const workspaceMatch =
    filters.workspaceId === "all" || filters.workspaceId === result.workspace.id;
  const kindMatch = filters.assetKind === "all" || filters.assetKind === result.asset.kind;
  const statusMatch = filters.status === "all" || filters.status === result.asset.status;

  return workspaceMatch && kindMatch && statusMatch;
}

function queryDashboardAssets(state: DashboardState): readonly DashboardAssetResult[] {
  return flattenDashboardAssets(state).filter(
    (result) =>
      resultMatchesSearch(result, state.search.query) &&
      resultMatchesFilters(result, state.filters),
  );
}

export function searchDashboardAssets(
  input: DashboardStateInput = {},
): readonly DashboardAssetResult[] {
  return queryDashboardAssets(createDashboardState(input));
}

export function searchDashboardMasters(
  input: DashboardStateInput = {},
): readonly DashboardAssetResult[] {
  return searchDashboardAssets(input).filter((result) => result.asset.kind === "master");
}

export function getMasterSearchPath(
  query: string,
  input: DashboardStateInput = {},
): DashboardSearchPath | undefined {
  const state = createDashboardState({
    ...input,
    search: {
      ...input.search,
      query,
    },
  });
  const result = queryDashboardAssets(state).find((assetResult) => assetResult.asset.kind === "master");

  if (!result) {
    return undefined;
  }

  return {
    result,
    interactions: result.reachInteractions,
  };
}

function renderAssetChips(asset: DashboardAsset): string {
  const chips = [
    formatKind(asset.kind),
    formatStatus(asset.status),
    ...(asset.sizeLabels ?? []),
  ];

  return chips
    .map((chip) => `<span class="dc-dashboard-chip">${escapeHtml(chip)}</span>`)
    .join("");
}

function renderAssetMeta(result: DashboardAssetResult): string {
  const variationText =
    typeof result.asset.variationCount === "number"
      ? `<span>${result.asset.variationCount} variations</span>`
      : "";
  const templateText = result.asset.templateName
    ? `<span>${escapeHtml(result.asset.templateName)}</span>`
    : "";

  return `<div class="dc-dashboard-card__meta">
    <span>${escapeHtml(result.workspace.name)} / ${escapeHtml(result.project.name)}</span>
    <span>${escapeHtml(result.asset.updatedLabel)}</span>
    <span>${escapeHtml(result.asset.owner)}</span>
    ${variationText}
    ${templateText}
  </div>`;
}

function renderAssetCard(result: DashboardAssetResult): string {
  const asset = result.asset;
  const actionLabel = `Open ${asset.kind}`;
  const masterAttribute =
    asset.kind === "master" ? ` data-master-id="${escapeHtml(asset.id)}"` : "";

  return `<article class="dc-dashboard-card" data-asset-id="${escapeHtml(asset.id)}" data-kind="${asset.kind}" data-status="${asset.status}">
    <div class="dc-dashboard-card__main">
      <div>
        <h3>${escapeHtml(asset.name)}</h3>
        ${renderAssetMeta(result)}
      </div>
      <div class="dc-dashboard-card__chips">${renderAssetChips(asset)}</div>
    </div>
    <a class="dc-dashboard-card__action" href="${escapeHtml(asset.route)}" data-reach-interactions="${result.reachInteractions}"${masterAttribute}>${escapeHtml(actionLabel)}</a>
  </article>`;
}

function renderAssetSection(label: string, results: readonly DashboardAssetResult[]): string {
  const body =
    results.length > 0
      ? results.map(renderAssetCard).join("")
      : `<p class="dc-dashboard-empty">No matches</p>`;

  return `<section class="dc-dashboard-section" aria-label="${escapeHtml(label)}">
    <header class="dc-dashboard-section__header">
      <h2>${escapeHtml(label)}</h2>
      <span>${results.length}</span>
    </header>
    <div class="dc-dashboard-list">${body}</div>
  </section>`;
}

function renderWorkspaceProjects(workspaces: readonly DashboardWorkspace[]): string {
  const sections = workspaces
    .map((workspace) => {
      const projects = workspace.projects
        .map((project) => {
          const masterCount = project.assets.filter((asset) => asset.kind === "master").length;
          const templateCount = project.assets.filter((asset) => asset.kind === "template").length;
          const variationCount = project.assets.filter((asset) => asset.kind === "variation").length;

          return `<li data-project-id="${escapeHtml(project.id)}">
            <span>
              <strong>${escapeHtml(project.name)}</strong>
              <small>${masterCount} masters / ${templateCount} templates / ${variationCount} variations</small>
            </span>
            <span>${escapeHtml(project.brand)}</span>
          </li>`;
        })
        .join("");

      return `<section class="dc-dashboard-workspace" data-workspace-id="${escapeHtml(workspace.id)}" aria-label="${escapeHtml(workspace.name)}">
        <header>
          <h2>${escapeHtml(workspace.name)}</h2>
          <span>${escapeHtml(workspace.brand)}</span>
        </header>
        <ol>${projects}</ol>
      </section>`;
    })
    .join("");

  return `<section class="dc-dashboard-section" aria-label="Projects by workspace">
    <header class="dc-dashboard-section__header">
      <h2>Projects by workspace</h2>
      <span>${workspaces.length}</span>
    </header>
    <div class="dc-dashboard-workspaces">${sections}</div>
  </section>`;
}

export function renderDashboardScreen(input: DashboardStateInput = {}): string {
  const state = createDashboardState(input);
  const results = queryDashboardAssets(state);
  const masterResults = results.filter((result) => result.asset.kind === "master");
  const allAssets = flattenDashboardAssets(state);
  const recentResults = state.recentAssetIds
    .map((assetId) => allAssets.find((result) => result.asset.id === assetId))
    .filter((result): result is DashboardAssetResult => result !== undefined);

  return `<div class="dc-shell dc-dashboard-shell">
    ${TopBar({
      projectPath: ["Workspace", "Dashboard"],
      saveState: "Synced",
      collaborators: ["GC", "AM"],
      actions: DASHBOARD_TOP_ACTIONS,
    })}
    <div class="dc-dashboard-body">
      ${IconRail({ activeItemId: "projects", items: DASHBOARD_RAIL_ITEMS })}
      ${WorkspaceTree({
        workspaces: state.workspaces,
        activeWorkspaceId: state.filters.workspaceId,
      })}
      <main class="dc-dashboard-main" data-region="workspace-dashboard" aria-label="Workspace dashboard">
        <header class="dc-dashboard-header">
          <h1>Workspace dashboard</h1>
          <span>${state.workspaces.length} brand workspaces</span>
        </header>
        ${Search({
          search: state.search,
          resultCount: results.length,
          masterResultCount: masterResults.length,
          maxInteractions: DEFAULT_DASHBOARD_INTERACTION_LIMIT,
        })}
        ${Filters({ filters: state.filters, workspaces: state.workspaces })}
        <div class="dc-dashboard-grid">
          ${renderAssetSection("Recent", recentResults)}
          ${renderAssetSection("Search results", results)}
          ${renderWorkspaceProjects(state.workspaces)}
        </div>
      </main>
    </div>
  </div>`;
}
