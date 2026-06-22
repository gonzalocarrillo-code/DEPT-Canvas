import { escapeHtml } from "../../design/Button.js";
import type { AdvancedGenerationControls } from "./actions.js";

export const DEFAULT_ADVANCED_CONTROLS: AdvancedGenerationControls = {
  guidance: "Keep product claims conservative and preserve brand terms.",
  charCap: 80,
  negativeKeywords: "discount, flash sale",
  referencePins: ["hero-product"],
  stylePins: ["brand-clean"],
};

function pinsToValue(pins: readonly string[]): string {
  return pins.join(", ");
}

export function renderAdvancedControls(
  controls: AdvancedGenerationControls = DEFAULT_ADVANCED_CONTROLS,
): string {
  return `<details class="dc-ai-controls dc-ai-controls--advanced" open>
    <summary>Advanced</summary>
    <label>
      <span>Guidance</span>
      <textarea name="guidance" rows="3">${escapeHtml(controls.guidance)}</textarea>
    </label>
    <label>
      <span>Character cap</span>
      <input name="charCap" type="number" min="1" value="${controls.charCap}" data-generate-asset-char-cap="${controls.charCap}" />
    </label>
    <label>
      <span>Negative keywords</span>
      <input name="negativeKeywords" value="${escapeHtml(controls.negativeKeywords)}" />
    </label>
    <label>
      <span>Reference pins</span>
      <input name="referencePins" value="${escapeHtml(pinsToValue(controls.referencePins))}" />
    </label>
    <label>
      <span>Style pins</span>
      <input name="stylePins" value="${escapeHtml(pinsToValue(controls.stylePins))}" />
    </label>
  </details>`;
}
