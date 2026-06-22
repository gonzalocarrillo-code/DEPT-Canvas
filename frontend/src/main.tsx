import { defaultShellState, renderShell, type ShellState } from "./app/Shell.js";

export interface ShellMountTarget {
  innerHTML: string;
}

export function mountDeptCanvasShell(
  target: ShellMountTarget,
  state: ShellState = defaultShellState,
): void {
  target.innerHTML = renderShell(state);
}

const browserGlobal = globalThis as {
  document?: {
    getElementById(id: string): ShellMountTarget | null;
  };
};

const root = browserGlobal.document?.getElementById("root");

if (root) {
  mountDeptCanvasShell(root);
}
