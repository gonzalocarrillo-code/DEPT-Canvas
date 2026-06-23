import { describe, expect, it } from "vitest";
import {
  createDashboardNavGraph,
  DEFAULT_DASHBOARD_INTERACTION_LIMIT,
  defaultDashboardState,
  getMasterSearchPath,
  renderDashboardScreen,
  searchDashboardAssets,
  searchDashboardMasters,
  shortestDashboardPathLength,
} from "../src/dashboard/DashboardScreen.js";

describe("P3-T5 workspace dashboard", () => {
  it("search returns a master in <=2 interactions", () => {
    const path = getMasterSearchPath("solar hero");

    expect(path).toBeDefined();
    expect(path?.result.asset.id).toBe("master-solar-hero");
    expect(path?.result.asset.kind).toBe("master");
    expect(path?.interactions).toBeLessThanOrEqual(DEFAULT_DASHBOARD_INTERACTION_LIMIT);

    const markup = renderDashboardScreen({
      search: {
        query: "solar hero",
      },
    });

    expect(markup).toContain('data-master-id="master-solar-hero"');
    expect(markup).toContain('data-reach-interactions="2"');
  });

  it("derives reach from the navigation graph", () => {
    const state = {
      search: {
        query: "solar hero",
      },
    };
    const graph = createDashboardNavGraph({
      ...defaultDashboardState,
      search: state.search,
    });

    expect(shortestDashboardPathLength(graph, "dashboard", "asset:master-solar-hero")).toBe(2);
    expect(getMasterSearchPath("solar hero")?.interactions).toBe(2);
    expect(getMasterSearchPath("", { recentAssetIds: ["master-solar-hero"] })?.interactions).toBe(1);
  });

  it("groups projects by brand workspace", () => {
    const markup = renderDashboardScreen();

    for (const workspace of defaultDashboardState.workspaces) {
      expect(markup).toContain(`data-workspace-id="${workspace.id}"`);
      expect(markup).toContain(workspace.name);
    }

    expect(markup).toContain("Projects by workspace");
    expect(markup).toContain("Summer launch");
    expect(markup).toContain("Spring drop");
  });

  it("shows templates and variations alongside masters", () => {
    const markup = renderDashboardScreen();

    expect(markup).toContain('data-kind="master"');
    expect(markup).toContain('data-kind="template"');
    expect(markup).toContain('data-kind="variation"');
    expect(markup).toContain("Hero launch template");
    expect(markup).toContain("Solar hero reels cut");
  });

  it("filters search results without losing master lookup", () => {
    const variationResults = searchDashboardAssets({
      filters: {
        assetKind: "variation",
      },
      search: {
        query: "spring",
      },
    });
    const masterResults = searchDashboardMasters({
      filters: {
        workspaceId: "northstar-retail",
      },
      search: {
        query: "spring",
      },
    });

    expect(variationResults).toHaveLength(1);
    expect(variationResults[0]?.asset.kind).toBe("variation");
    expect(masterResults).toHaveLength(1);
    expect(masterResults[0]?.asset.id).toBe("master-spring-lookbook");
  });
});
