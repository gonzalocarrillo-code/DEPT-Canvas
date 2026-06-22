import { escapeHtml } from "../design/Button.js";

export type RenderVariantFormat = "png" | "jpeg" | "pdf" | "mp4";

export interface RenderVariantOutputSpec {
  readonly width: number;
  readonly height: number;
  readonly durationSec?: number;
  readonly format: RenderVariantFormat;
}

export interface SizePreset {
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export interface VariationMatrix {
  readonly sizes: readonly SizePreset[];
  readonly durationsSec: readonly number[];
  readonly copyVariants: readonly string[];
  readonly backgrounds: readonly string[];
}

export interface VariationCostEstimate {
  readonly generationCount: number;
  readonly renderCount: number;
  readonly count: number;
  readonly costUsd: number;
  readonly etaSec: number;
  readonly outputs: readonly RenderVariantOutputSpec[];
}

const GENERATION_COST_USD = 0.02;
const RENDER_COST_USD = 0.005;

export function estimateVariationBatch(matrix: VariationMatrix): VariationCostEstimate {
  const generationCount = countGenerationKeys(matrix);
  const outputs = buildRenderOutputs(matrix, generationCount);
  const renderCount = outputs.length;
  const costUsd = roundUsd(generationCount * GENERATION_COST_USD + renderCount * RENDER_COST_USD);
  const etaSec = generationCount * 8 + renderCount * 3;

  return {
    generationCount,
    renderCount,
    count: renderCount,
    costUsd,
    etaSec,
    outputs,
  };
}

export function countGenerationKeys(matrix: VariationMatrix): number {
  const copyCount = Math.max(1, matrix.copyVariants.length);
  const backgroundCount = Math.max(1, matrix.backgrounds.length);

  return copyCount * backgroundCount;
}

export function buildRenderOutputs(
  matrix: VariationMatrix,
  generationCount = countGenerationKeys(matrix),
): readonly RenderVariantOutputSpec[] {
  return matrix.sizes.flatMap((size) =>
    matrix.durationsSec.flatMap((durationSec) =>
      Array.from({ length: generationCount }, () => ({
        width: size.width,
        height: size.height,
        durationSec,
        format: "mp4" as const,
      })),
    ),
  );
}

export function renderCostEstimate(estimate: VariationCostEstimate): string {
  return `<section class="dc-variation-estimate" data-generation-gate="before-generate" aria-label="Batch estimate">
    <div>
      <span class="dc-estimate-value">${escapeHtml(String(estimate.count))}</span>
      <span>variants</span>
    </div>
    <div>
      <span class="dc-estimate-value">${escapeHtml(formatUsd(estimate.costUsd))}</span>
      <span>estimated cost</span>
    </div>
    <div>
      <span class="dc-estimate-value">${escapeHtml(String(estimate.etaSec))} sec</span>
      <span>estimated time</span>
    </div>
    <div>
      <span class="dc-estimate-value">${escapeHtml(String(estimate.generationCount))}</span>
      <span>generated assets</span>
    </div>
  </section>`;
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

function roundUsd(value: number): number {
  return Math.round(value * 10000) / 10000;
}
