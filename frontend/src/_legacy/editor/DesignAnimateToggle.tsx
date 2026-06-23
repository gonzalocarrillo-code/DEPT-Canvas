import { Button } from "../design/Button.js";

export type EditorMode = "design" | "animate";

export interface DesignAnimateToggleProps {
  readonly mode: EditorMode;
}

export function renderDesignAnimateToggle({ mode }: DesignAnimateToggleProps): string {
  return `<div class="dc-mode-toggle" role="group" aria-label="Design or animate">
    ${Button({ label: "Design", pressed: mode === "design", tone: "ghost" })}
    ${Button({ label: "Animate", pressed: mode === "animate", tone: "ghost" })}
  </div>`;
}

