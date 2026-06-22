import { escapeHtml } from "../design/Button.js";
import { type CanvasFormatId, findCanvasFormat } from "./FormatSwitcher.js";

export const CESDK_BROWSER_PACKAGE = "@cesdk/cesdk-js";
export const CESDK_LICENSE_ENV_VAR = "VITE_CESDK_LICENSE";

export interface CesdkMount {
  readonly packageName: typeof CESDK_BROWSER_PACKAGE;
  readonly mountId: string;
  readonly sceneRef: string;
  readonly selectedLayerId: string;
  readonly licenseEnvVar: typeof CESDK_LICENSE_ENV_VAR;
}

export interface UseCesdkOptions {
  readonly mountId?: string;
  readonly sceneRef?: string;
  readonly selectedLayerId?: string;
}

export function useCesdk({
  mountId = "dept-cesdk-editor",
  sceneRef = "summer-launch-master.scene",
  selectedLayerId = "",
}: UseCesdkOptions = {}): CesdkMount {
  return {
    packageName: CESDK_BROWSER_PACKAGE,
    mountId,
    sceneRef,
    selectedLayerId,
    licenseEnvVar: CESDK_LICENSE_ENV_VAR,
  };
}

export interface CesdkCanvasProps {
  readonly activeFormat: CanvasFormatId;
  readonly sceneRef: string;
  readonly selectedLayerId: string;
  readonly layerBlockIds?: Readonly<Record<string, string>>;
  readonly mountId?: string;
}

export interface CesdkRuntimeEnv {
  readonly VITE_CESDK_LICENSE?: string;
  readonly VITE_IMGLY_LOCAL_ASSETS_URL?: string;
  readonly VITE_CESDK_USER_ID?: string;
}

export interface CesdkRuntimeConfig {
  readonly license: string;
  readonly userId: string;
  readonly role: "Creator";
  readonly baseURL?: string;
}

export interface CesdkSelectionBridge {
  readonly selectedLayerId?: string;
  readonly dispose: () => void;
}

export interface CesdkEditorInstance {
  readonly engine?: {
    readonly block?: {
      findAllSelected?: () => readonly unknown[];
      onSelectionChanged?: (listener: () => void) => (() => void) | undefined;
      getUUID?: (block: unknown) => string;
      getName?: (block: unknown) => string;
    };
  };
}

export interface MountCesdkEditorOptions {
  readonly mountId?: string;
  readonly sceneRef?: string;
  readonly selectedLayerId?: string;
  readonly layerBlockIds?: Readonly<Record<string, string>>;
  readonly env?: CesdkRuntimeEnv;
  readonly onSelectedLayerIdChange?: (layerId: string) => void;
}

interface CesdkMountTarget {
  setAttribute(name: string, value: string): void;
}

function readViteEnv(): CesdkRuntimeEnv {
  return import.meta.env ?? {};
}

export function createCesdkRuntimeConfig(
  env: CesdkRuntimeEnv = readViteEnv(),
): CesdkRuntimeConfig {
  const license = env.VITE_CESDK_LICENSE?.trim();

  if (!license) {
    throw new Error(`${CESDK_LICENSE_ENV_VAR} is required to mount CE.SDK`);
  }

  return {
    license,
    userId: env.VITE_CESDK_USER_ID?.trim() || "dept-canvas-editor",
    role: "Creator",
    ...(env.VITE_IMGLY_LOCAL_ASSETS_URL
      ? { baseURL: env.VITE_IMGLY_LOCAL_ASSETS_URL }
      : {}),
  };
}

function resolveSelectedLayerId(
  cesdk: CesdkEditorInstance,
  layerBlockIds: Readonly<Record<string, string>>,
): string | undefined {
  const blockApi = cesdk.engine?.block;
  const selectedBlocks = blockApi?.findAllSelected?.() ?? [];

  for (const block of selectedBlocks) {
    const candidates = [
      String(block),
      blockApi?.getUUID?.(block),
      blockApi?.getName?.(block),
    ].filter((candidate): candidate is string => typeof candidate === "string");
    const match = Object.entries(layerBlockIds).find(([, blockId]) =>
      candidates.includes(blockId),
    );

    if (match) {
      return match[0];
    }
  }

  return undefined;
}

export function wireCesdkLayerSelection({
  cesdk,
  layerBlockIds,
  selectedLayerId,
  onSelectedLayerIdChange,
}: {
  readonly cesdk: CesdkEditorInstance;
  readonly layerBlockIds: Readonly<Record<string, string>>;
  readonly selectedLayerId?: string;
  readonly onSelectedLayerIdChange?: (layerId: string) => void;
}): CesdkSelectionBridge {
  const emitSelection = (): void => {
    const layerId = resolveSelectedLayerId(cesdk, layerBlockIds);

    if (layerId) {
      onSelectedLayerIdChange?.(layerId);
    }
  };
  const unsubscribe = cesdk.engine?.block?.onSelectionChanged?.(emitSelection);

  return {
    selectedLayerId,
    dispose: () => unsubscribe?.(),
  };
}

export async function mountCesdkEditor({
  mountId = "dept-cesdk-editor",
  sceneRef,
  selectedLayerId,
  layerBlockIds = {},
  env,
  onSelectedLayerIdChange,
}: MountCesdkEditorOptions = {}): Promise<{
  readonly cesdk: unknown;
  readonly selection: CesdkSelectionBridge;
}> {
  const browserGlobal = globalThis as {
    readonly document?: {
      getElementById(id: string): CesdkMountTarget | null;
    };
  };
  const container = browserGlobal.document?.getElementById(mountId);

  if (!container) {
    throw new Error(`CE.SDK mount target '${mountId}' was not found`);
  }

  const { default: CreativeEditorSDK } = await import("@cesdk/cesdk-js");
  const cesdk = await CreativeEditorSDK.create(container, createCesdkRuntimeConfig(env));
  const typedCesdk = cesdk as CesdkEditorInstance;
  const selection = wireCesdkLayerSelection({
    cesdk: typedCesdk,
    layerBlockIds,
    selectedLayerId,
    onSelectedLayerIdChange,
  });

  container.setAttribute("data-cesdk-mounted", "true");
  if (sceneRef) {
    container.setAttribute("data-scene-ref", sceneRef);
  }

  return {
    cesdk,
    selection,
  };
}

export function renderCesdkCanvas({
  activeFormat,
  sceneRef,
  selectedLayerId,
  layerBlockIds = {},
  mountId,
}: CesdkCanvasProps): string {
  const cesdk = useCesdk({ mountId, sceneRef, selectedLayerId });
  const format = findCanvasFormat(activeFormat);
  const aspectRatio = `${format.width} / ${format.height}`;
  const layerBlockMap = JSON.stringify(layerBlockIds);

  return `<section class="dc-cesdk-canvas" aria-label="Editable scene canvas" data-cesdk-package="${escapeHtml(cesdk.packageName)}" data-license-source="${cesdk.licenseEnvVar}" data-scene-ref="${escapeHtml(cesdk.sceneRef)}" data-selected-layer-id="${escapeHtml(cesdk.selectedLayerId)}">
    <div id="${escapeHtml(cesdk.mountId)}" class="dc-cesdk-mount" data-cesdk-mount="true" data-format="${escapeHtml(format.id)}" data-format-width="${format.width}" data-format-height="${format.height}" data-layer-block-map="${escapeHtml(layerBlockMap)}" style="aspect-ratio: ${aspectRatio}"></div>
  </section>`;
}
