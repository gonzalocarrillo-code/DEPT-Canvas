import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  SHELL_REGIONS,
  SHELL_TEXT_LABELS,
  SHELL_TIMELINE_DEFAULT_COLLAPSED,
  renderShell,
} from "../src/app/Shell.js";

function isSentenceCase(label: string): boolean {
  const words = label.split(/\s+/).filter(Boolean);
  return words.every((word, index) => {
    if (/^[A-Z]{2,}$/.test(word)) {
      return true;
    }

    return index === 0 || !/^[A-Z][a-z]+$/.test(word);
  });
}

describe("P3-T1 shell", () => {
  it("renders every app shell region", () => {
    const markup = renderShell();

    for (const region of SHELL_REGIONS) {
      expect(markup).toContain(`data-region="${region}"`);
    }
  });

  it("uses sentence-case labels and exactly two font-weight tokens", () => {
    for (const label of SHELL_TEXT_LABELS) {
      expect(isSentenceCase(label), label).toBe(true);
    }

    const css = readFileSync(new URL("../src/design/tokens.css", import.meta.url), "utf8");
    const weights = [
      ...css.matchAll(/--dept-font-weight-[\w-]+:\s*(\d+);/g),
    ].map((match) => match[1]);

    expect([...new Set(weights)].sort()).toEqual(["400", "600"]);
    expect(css).not.toMatch(/linear-gradient|box-shadow/i);
  });

  it("keeps the timeline collapsed by default", () => {
    expect(SHELL_TIMELINE_DEFAULT_COLLAPSED).toBe(true);
    expect(renderShell()).toContain('data-region="bottom-timeline" data-collapsed="true"');
  });
});
