import { create } from "zustand";

export type ProjectStatus = "draft" | "in-progress" | "approved";

export interface ProjectSummary {
  id: string;
  name: string;
  workspace: string;
  status: ProjectStatus;
  formats: string[];
  updatedLabel: string;
  sceneCount: number;
  variationCount: number;
  /** Hue (0-360) used to tint the card thumbnail. */
  accent: number;
}

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 8);
  } catch {
    return Math.abs(Date.now() ^ (Math.random() * 1e9)).toString(36).slice(0, 8);
  }
}

// Seeded so the finder is real and navigable. Replaced by the API-backed list in P4/P7.
const seed: ProjectSummary[] = [
  { id: "aurora-fw", name: "Aurora — Fall/Winter launch", workspace: "Aurora Apparel", status: "in-progress", formats: ["1:1", "9:16", "16:9"], updatedLabel: "2h ago", sceneCount: 4, variationCount: 128, accent: 265 },
  { id: "northwind", name: "Northwind summer promo", workspace: "Northwind", status: "approved", formats: ["1:1", "4:5"], updatedLabel: "yesterday", sceneCount: 3, variationCount: 64, accent: 188 },
  { id: "lumen-drop", name: "Lumen app — feature drops", workspace: "Lumen", status: "draft", formats: ["9:16"], updatedLabel: "3 days ago", sceneCount: 1, variationCount: 0, accent: 150 },
  { id: "vela-aon", name: "Vela retail — always-on", workspace: "Vela", status: "in-progress", formats: ["1:1", "16:9"], updatedLabel: "5 days ago", sceneCount: 6, variationCount: 240, accent: 322 },
  { id: "dept-reels", name: "DEPT brand reels", workspace: "DEPT Internal", status: "approved", formats: ["9:16", "1:1"], updatedLabel: "1 week ago", sceneCount: 2, variationCount: 36, accent: 32 },
  { id: "kontur-tz", name: "Kontur — product teasers", workspace: "Kontur", status: "draft", formats: ["16:9"], updatedLabel: "2 weeks ago", sceneCount: 1, variationCount: 12, accent: 228 },
];

interface ProjectsState {
  projects: ProjectSummary[];
  createProject: (input: {
    name?: string;
    workspace?: string;
    entry: "brief" | "scratch";
  }) => ProjectSummary;
  getProject: (id: string) => ProjectSummary | undefined;
}

export const useProjectsStore = create<ProjectsState>()((set, get) => ({
  projects: seed,
  createProject: ({ name, workspace }) => {
    const project: ProjectSummary = {
      id: makeId(),
      name: name?.trim() || "Untitled project",
      workspace: workspace?.trim() || "My workspace",
      status: "draft",
      formats: ["1:1"],
      updatedLabel: "just now",
      sceneCount: 0,
      variationCount: 0,
      accent: 265,
    };
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },
  getProject: (id) => get().projects.find((p) => p.id === id),
}));
