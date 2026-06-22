import { escapeHtml } from "../../design/Button.js";
import type { SimpleGenerationControls } from "./actions.js";

export const DEFAULT_SIMPLE_CONTROLS: SimpleGenerationControls = {
  prompt: "Make this feel launch-ready while staying on brand.",
  tone: "premium",
};

const TONE_OPTIONS: readonly SimpleGenerationControls["tone"][] = [
  "direct",
  "warm",
  "premium",
  "playful",
];

function renderToneOptions(activeTone: SimpleGenerationControls["tone"]): string {
  return TONE_OPTIONS.map((tone) => {
    const selected = tone === activeTone ? " selected" : "";
    return `<option value="${tone}"${selected}>${escapeHtml(tone)}</option>`;
  }).join("");
}

export function renderSimpleControls(
  controls: SimpleGenerationControls = DEFAULT_SIMPLE_CONTROLS,
): string {
  return `<fieldset class="dc-ai-controls dc-ai-controls--simple">
    <legend>Simple</legend>
    <label>
      <span>Prompt</span>
      <textarea name="prompt" rows="3">${escapeHtml(controls.prompt)}</textarea>
    </label>
    <label>
      <span>Tone</span>
      <select name="tone">${renderToneOptions(controls.tone)}</select>
    </label>
  </fieldset>`;
}
