import { create } from "zustand";

export type CellStatus = "queued" | "rendering" | "done" | "approved" | "rejected";

export interface BatchCell {
  id: string;
  format: string;
  locale: string;
  status: CellStatus;
  hue: number;
}

export const FORMAT_OPTIONS = ["1:1", "9:16", "16:9", "4:5"];
export const LOCALE_OPTIONS = ["EN", "ES", "FR", "DE", "JP", "BR"];

function makeId(): string {
  try {
    return crypto.randomUUID().slice(0, 6);
  } catch {
    return Math.floor(Math.random() * 1e6).toString(36);
  }
}

interface BatchState {
  projectId: string | null;
  selFormats: string[];
  selLocales: string[];
  cells: BatchCell[];
  generated: boolean;
  load: (projectId: string) => void;
  toggleFormat: (f: string) => void;
  toggleLocale: (l: string) => void;
  generate: () => void;
  approveCell: (id: string) => void;
  rejectCell: (id: string) => void;
  approveAll: () => void;
  reset: () => void;
}

export const useBatchStore = create<BatchState>()((set, get) => ({
  projectId: null,
  selFormats: ["1:1", "9:16", "16:9"],
  selLocales: ["EN", "ES", "FR"],
  cells: [],
  generated: false,
  load: (projectId) => {
    if (get().projectId === projectId) return;
    set({ projectId, cells: [], generated: false });
  },
  toggleFormat: (f) =>
    set((s) => ({
      selFormats: s.selFormats.includes(f)
        ? s.selFormats.filter((x) => x !== f)
        : [...s.selFormats, f],
    })),
  toggleLocale: (l) =>
    set((s) => ({
      selLocales: s.selLocales.includes(l)
        ? s.selLocales.filter((x) => x !== l)
        : [...s.selLocales, l],
    })),
  generate: () => {
    const { selFormats, selLocales } = get();
    const cells: BatchCell[] = [];
    let i = 0;
    // generate-once / render-many: one cell per locale × format of the master.
    for (const locale of selLocales) {
      for (const format of selFormats) {
        cells.push({
          id: `${locale}-${format}-${makeId()}`,
          format,
          locale,
          status: "queued",
          hue: 200 + ((i * 37) % 150),
        });
        i++;
      }
    }
    set({ cells, generated: true });
    cells.forEach((c, idx) => {
      window.setTimeout(
        () => set((s) => ({ cells: s.cells.map((x) => (x.id === c.id ? { ...x, status: "rendering" } : x)) })),
        200 + idx * 110,
      );
      window.setTimeout(
        () => set((s) => ({ cells: s.cells.map((x) => (x.id === c.id ? { ...x, status: "done" } : x)) })),
        850 + idx * 110,
      );
    });
  },
  approveCell: (id) =>
    set((s) => ({ cells: s.cells.map((c) => (c.id === id ? { ...c, status: "approved" } : c)) })),
  rejectCell: (id) =>
    set((s) => ({ cells: s.cells.map((c) => (c.id === id ? { ...c, status: "rejected" } : c)) })),
  approveAll: () =>
    set((s) => ({
      cells: s.cells.map((c) =>
        c.status === "done" || c.status === "rejected" ? { ...c, status: "approved" } : c,
      ),
    })),
  reset: () => set({ cells: [], generated: false }),
}));
