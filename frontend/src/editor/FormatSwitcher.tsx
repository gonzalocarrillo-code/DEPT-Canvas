import { Button, escapeHtml } from "../design/Button.js";

export type CanvasFormatId = "1:1" | "9:16" | "16:9" | "4:5";

export interface CanvasFormat {
  readonly id: CanvasFormatId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const CANVAS_FORMATS: readonly CanvasFormat[] = [
  { id: "1:1", label: "1:1", width: 1080, height: 1080 },
  { id: "9:16", label: "9:16", width: 1080, height: 1920 },
  { id: "16:9", label: "16:9", width: 1920, height: 1080 },
  { id: "4:5", label: "4:5", width: 1080, height: 1350 },
];

export function findCanvasFormat(id: CanvasFormatId): CanvasFormat {
  return CANVAS_FORMATS.find((format) => format.id === id) ?? CANVAS_FORMATS[0];
}

export interface FormatSwitcherProps {
  readonly activeFormat: CanvasFormatId;
}

export function renderFormatSwitcher({ activeFormat }: FormatSwitcherProps): string {
  const options = CANVAS_FORMATS.map((format) => {
    const selected = format.id === activeFormat;
    return `<span class="dc-format-switcher__option" data-format-option="${escapeHtml(format.id)}">
      ${Button({ label: format.label, pressed: selected, tone: "ghost" })}
    </span>`;
  }).join("");

  return `<div class="dc-format-switcher" role="group" aria-label="Format switcher">${options}</div>`;
}

