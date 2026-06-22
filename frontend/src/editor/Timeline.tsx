import type { MotionRealization } from "../../../scene-mcp/src/motion/motion-engine.js";
import { escapeHtml } from "../design/Button.js";

export type TimelinePresetKind = "in" | "loop" | "out";

export interface TimelinePresetBar {
  readonly kind: TimelinePresetKind;
  readonly label: string;
  readonly preset: string;
  readonly startSec: number;
  readonly durationSec: number;
  readonly realizedAs: MotionRealization;
}

export interface EditorLayer {
  readonly id: string;
  readonly name: string;
  readonly role: "brand" | "copy" | "image" | "background";
  readonly locked: boolean;
  readonly bars: readonly TimelinePresetBar[];
}

export interface TimelineState {
  readonly durationSec: number;
  readonly scrubberSec: number;
  readonly staggerStepSec: number;
  readonly layers: readonly EditorLayer[];
}

export const DEFAULT_TIMELINE_STATE: TimelineState = {
  durationSec: 6,
  scrubberSec: 1.8,
  staggerStepSec: 0.12,
  layers: [
    {
      id: "logo",
      name: "Logo",
      role: "brand",
      locked: true,
      bars: [
        {
          kind: "in",
          label: "In fade",
          preset: "//ly.img.ubq/animation/fade",
          startSec: 0,
          durationSec: 0.45,
          realizedAs: "native",
        },
        {
          kind: "out",
          label: "Out fade",
          preset: "//ly.img.ubq/animation/fade",
          startSec: 5.4,
          durationSec: 0.45,
          realizedAs: "native",
        },
      ],
    },
    {
      id: "hero-copy",
      name: "Hero copy",
      role: "copy",
      locked: false,
      bars: [
        {
          kind: "in",
          label: "In slide",
          preset: "//ly.img.ubq/animation/slide",
          startSec: 0.12,
          durationSec: 0.6,
          realizedAs: "native",
        },
        {
          kind: "loop",
          label: "Loop pulse",
          preset: "//ly.img.ubq/animation/pulse",
          startSec: 1.1,
          durationSec: 3.6,
          realizedAs: "composed",
        },
        {
          kind: "out",
          label: "Out blur",
          preset: "//ly.img.ubq/animation/blur",
          startSec: 5.1,
          durationSec: 0.55,
          realizedAs: "native",
        },
      ],
    },
    {
      id: "product-image",
      name: "Product image",
      role: "image",
      locked: false,
      bars: [
        {
          kind: "in",
          label: "In grow",
          preset: "//ly.img.ubq/animation/grow",
          startSec: 0.24,
          durationSec: 0.7,
          realizedAs: "native",
        },
        {
          kind: "loop",
          label: "Loop ken burns",
          preset: "//ly.img.ubq/animation/ken_burns",
          startSec: 1,
          durationSec: 4,
          realizedAs: "native",
        },
      ],
    },
  ],
};

function percent(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.max(0, Math.min(100, (value / total) * 100)).toFixed(2)}%`;
}

function renderPresetBar(bar: TimelinePresetBar, durationSec: number): string {
  const left = percent(bar.startSec, durationSec);
  const width = percent(bar.durationSec, durationSec);

  return `<span class="dc-timeline-bar dc-timeline-bar--${escapeHtml(bar.kind)}" data-preset-kind="${escapeHtml(bar.kind)}" data-preset="${escapeHtml(bar.preset)}" data-realized-as="${escapeHtml(bar.realizedAs)}" style="left: ${left}; width: ${width}">
    <span class="dc-timeline-bar__kind">${escapeHtml(bar.kind)}</span>
    <span class="dc-timeline-bar__label">${escapeHtml(bar.label)}</span>
  </span>`;
}

function renderTimelineLayer(
  layer: EditorLayer,
  durationSec: number,
  staggerStepSec: number,
): string {
  const lockBadge = layer.locked ? '<span class="dc-lock-badge">Locked</span>' : "";
  const bars = layer.bars.map((bar) => renderPresetBar(bar, durationSec)).join("");

  return `<li class="dc-timeline-layer" data-layer-id="${escapeHtml(layer.id)}" data-locked="${layer.locked ? "true" : "false"}">
    <div class="dc-timeline-layer__meta">
      <span>${escapeHtml(layer.name)}</span>
      ${lockBadge}
    </div>
    <div class="dc-timeline-layer__track">
      ${bars}
      <button class="dc-stagger-handle" type="button" aria-label="${escapeHtml(layer.name)} stagger handle" data-stagger-step="${staggerStepSec.toFixed(2)}"></button>
    </div>
  </li>`;
}

export function renderTimeline(state: TimelineState = DEFAULT_TIMELINE_STATE): string {
  const scrubberLeft = percent(state.scrubberSec, state.durationSec);
  const layers = state.layers
    .map((layer) => renderTimelineLayer(layer, state.durationSec, state.staggerStepSec))
    .join("");

  return `<div class="dc-tier-one-timeline" data-motion-tier="1" aria-label="Preset animation timeline">
    <div class="dc-timeline-ruler" aria-label="Timeline scrubber">
      <span class="dc-timeline-ruler__tick">0s</span>
      <span class="dc-timeline-ruler__tick">${state.durationSec.toFixed(0)}s</span>
      <input class="dc-timeline-scrubber" type="range" min="0" max="${state.durationSec}" step="0.1" value="${state.scrubberSec}" aria-label="Scrubber" />
      <span class="dc-scrubber-line" data-scrubber="true" style="left: ${scrubberLeft}"></span>
    </div>
    <ol class="dc-timeline-layers">${layers}</ol>
  </div>`;
}

