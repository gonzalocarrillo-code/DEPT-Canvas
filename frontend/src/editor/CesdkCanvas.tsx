import { escapeHtml } from "../design/Button.js";
import { type CanvasFormat, type CanvasFormatId, findCanvasFormat } from "./FormatSwitcher.js";

export const CESDK_BROWSER_PACKAGE = "@cesdk/cesdk-js";

export interface CesdkMount {
  readonly packageName: typeof CESDK_BROWSER_PACKAGE;
  readonly mountId: string;
  readonly sceneRef: string;
}

export interface UseCesdkOptions {
  readonly mountId?: string;
  readonly sceneRef?: string;
}

export function useCesdk({
  mountId = "dept-cesdk-editor",
  sceneRef = "summer-launch-master.scene",
}: UseCesdkOptions = {}): CesdkMount {
  return {
    packageName: CESDK_BROWSER_PACKAGE,
    mountId,
    sceneRef,
  };
}

export interface CesdkCanvasProps {
  readonly activeFormat: CanvasFormatId;
  readonly sceneRef: string;
  readonly mountId?: string;
}

function renderCanvasFrame(format: CanvasFormat): string {
  const aspectRatio = `${format.width} / ${format.height}`;

  return `<div class="dc-cesdk-frame" data-format="${escapeHtml(format.id)}" data-format-width="${format.width}" data-format-height="${format.height}" style="aspect-ratio: ${aspectRatio}">
    <div class="dc-cesdk-frame__content">
      <span class="dc-cesdk-frame__label">CE.SDK editor</span>
    </div>
  </div>`;
}

export function renderCesdkCanvas({
  activeFormat,
  sceneRef,
  mountId,
}: CesdkCanvasProps): string {
  const cesdk = useCesdk({ mountId, sceneRef });
  const format = findCanvasFormat(activeFormat);

  return `<section class="dc-cesdk-canvas" aria-label="Editable scene canvas" data-cesdk-package="${escapeHtml(cesdk.packageName)}" data-scene-ref="${escapeHtml(cesdk.sceneRef)}">
    <div id="${escapeHtml(cesdk.mountId)}" class="dc-cesdk-mount" data-cesdk-mount="true">
      ${renderCanvasFrame(format)}
    </div>
  </section>`;
}

