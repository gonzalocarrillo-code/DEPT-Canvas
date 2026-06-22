import "./design/tokens.css";
import {
  defaultEditorScreenState,
  renderEditorScreen,
  type EditorScreenState,
} from "./editor/EditorScreen.js";
import {
  wireCesdkLayerSelection,
  type CesdkEditorInstance,
  type CesdkSelectionBridge,
} from "./editor/CesdkCanvas.js";

export interface ShellMountTarget {
  innerHTML: string;
  setAttribute?(name: string, value: string): void;
}

export interface BrowserDocument {
  getElementById(id: string): ShellMountTarget | null;
}

export interface BrowserAppMountOptions {
  readonly state?: EditorScreenState;
  readonly initializeCesdk?: boolean;
  readonly document?: BrowserDocument;
}

export interface BrowserAppMount {
  readonly state: EditorScreenState;
  readonly initialize: () => Promise<void>;
}

function viteEnv(): { readonly VITE_CESDK_LICENSE?: string } {
  return import.meta.env ?? {};
}

export function mountDeptCanvasShell(
  target: ShellMountTarget,
  state: EditorScreenState = defaultEditorScreenState,
): void {
  target.innerHTML = renderEditorScreen(state);
  target.setAttribute?.("data-app-mounted", "true");
}

export async function initializeCesdkBrowserEditor({
  document,
  state,
  onSelectedLayerIdChange,
}: {
  readonly document: BrowserDocument;
  readonly state: EditorScreenState;
  readonly onSelectedLayerIdChange?: (layerId: string) => void;
}): Promise<CesdkSelectionBridge | undefined> {
  const el = document.getElementById("dept-cesdk-editor");
  const license = viteEnv().VITE_CESDK_LICENSE;

  if (!el) {
    return undefined;
  }

  if (!license) {
    el.setAttribute?.("data-cesdk-error", "missing-license");
    return undefined;
  }

  const { default: CreativeEditorSDK } = await import("@cesdk/cesdk-js");
  const cesdk = await CreativeEditorSDK.create(el, { license });

  el.setAttribute?.("data-cesdk-mounted", "true");

  return wireCesdkLayerSelection({
    cesdk: cesdk as CesdkEditorInstance,
    layerBlockIds: state.layerBlockIds,
    selectedLayerId: state.selectedLayerId,
    onSelectedLayerIdChange,
  });
}

export function mountDeptCanvasApp(
  target: ShellMountTarget,
  {
    state = defaultEditorScreenState,
    initializeCesdk = true,
    document,
  }: BrowserAppMountOptions = {},
): BrowserAppMount {
  let currentState = state;
  let selectionBridge: CesdkSelectionBridge | undefined;

  const render = (): void => {
    mountDeptCanvasShell(target, currentState);
  };
  const initialize = async (): Promise<void> => {
    if (!initializeCesdk || !document) {
      return;
    }

    selectionBridge?.dispose();
    selectionBridge = await initializeCesdkBrowserEditor({
      document,
      state: currentState,
      onSelectedLayerIdChange: (selectedLayerId) => {
        currentState = {
          ...currentState,
          selectedLayerId,
        };
        render();
        void initialize();
      },
    });
  };

  render();
  void initialize();

  return {
    state: currentState,
    initialize,
  };
}

const browserGlobal = globalThis as {
  document?: BrowserDocument;
};

const root = browserGlobal.document?.getElementById("root");

if (root) {
  mountDeptCanvasApp(root, {
    document: browserGlobal.document,
  });
}
